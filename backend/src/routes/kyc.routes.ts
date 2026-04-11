import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';
import { db } from '../db';
import { kycDocuments, users } from '../db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import multer from 'multer';

const router = Router();
router.use(authMiddleware);

// Store file in memory only — no disk writes at all
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG and PDF files are allowed'));
    }
  },
});

const uploadSchema = z.object({
  docType: z.enum(['AADHAAR_FRONT', 'AADHAAR_BACK', 'PAN', 'GST', 'SELFIE', 'CANCELLED_CHEQUE']),
});

const reviewSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
});

// POST /api/kyc/upload — upload KYC document (stored as binary in DB)
router.post('/upload', upload.single('document'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = uploadSchema.parse(req.body);

    if (!req.file) {
      res.status(400).json({ error: 'No document file attached' });
      return;
    }

    // Check if document already submitted
    const existing = await db
      .select()
      .from(kycDocuments)
      .where(
        and(
          eq(kycDocuments.userId, req.user!.userId),
          eq(kycDocuments.docType, body.docType)
        )
      )
      .limit(1);

    if (existing.length > 0 && existing[0].status === 'APPROVED') {
      res.status(400).json({ error: 'This document has already been approved' });
      return;
    }

    if (existing.length > 0) {
      // Update existing record with new binary data
      await db
        .update(kycDocuments)
        .set({
          fileData: req.file.buffer,
          mimeType: req.file.mimetype,
          originalName: req.file.originalname,
          status: 'PENDING',
          rejectionReason: null,
        })
        .where(eq(kycDocuments.id, existing[0].id));
    } else {
      await db.insert(kycDocuments).values({
        userId: req.user!.userId,
        docType: body.docType,
        fileData: req.file.buffer,
        mimeType: req.file.mimetype,
        originalName: req.file.originalname,
      });
    }

    // Update user KYC status to SUBMITTED
    await db
      .update(users)
      .set({ kycStatus: 'SUBMITTED', updatedAt: new Date() })
      .where(eq(users.id, req.user!.userId));

    res.json({ message: 'Document uploaded successfully' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(500).json({ error: error.message });
  }
});

// GET /api/kyc/file/:docId — stream a KYC file from the database
router.get(
  '/file/:docId',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { docId } = req.params as { docId: string };

      const [docs] = await db
        .select({
          fileData: kycDocuments.fileData,
          mimeType: kycDocuments.mimeType,
          originalName: kycDocuments.originalName,
          userId: kycDocuments.userId,
        })
        .from(kycDocuments)
        .where(eq(kycDocuments.id, docId));

      if (!docs) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      // Allow if it's the user's own document
      let isAuthorized = docs.userId === req.user!.userId;
      
      // Or if the user is the direct parent of the document owner
      if (!isAuthorized) {
        const [owner] = await db.select({ parentId: users.parentId }).from(users).where(eq(users.id, docs.userId));
        if (owner && owner.parentId === req.user!.userId) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized && req.user!.role !== 'SYSTEM') {
        res.status(403).json({ error: 'Not authorized to view this document' });
        return;
      }

      res.setHeader('Content-Type', docs.mimeType);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(docs.originalName)}"`
      );
      res.send(docs.fileData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/kyc/my — get my KYC documents (metadata only, no binary)
router.get('/my', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const docs = await db
      .select({
        id: kycDocuments.id,
        docType: kycDocuments.docType,
        mimeType: kycDocuments.mimeType,
        originalName: kycDocuments.originalName,
        status: kycDocuments.status,
        rejectionReason: kycDocuments.rejectionReason,
        createdAt: kycDocuments.createdAt,
      })
      .from(kycDocuments)
      .where(eq(kycDocuments.userId, req.user!.userId))
      .orderBy(kycDocuments.docType);

    res.json({ documents: docs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/kyc/pending — parent view all pending KYC of their direct children (metadata only)
router.get(
  '/pending',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Find all direct children
      const children = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.parentId, req.user!.userId));

      const childIds = children.map(c => c.id);

      if (childIds.length === 0) {
        res.json({ documents: [] });
        return;
      }

      const docs = await db
        .select({
          id: kycDocuments.id,
          userId: kycDocuments.userId,
          docType: kycDocuments.docType,
          mimeType: kycDocuments.mimeType,
          originalName: kycDocuments.originalName,
          status: kycDocuments.status,
          reviewedBy: kycDocuments.reviewedBy,
          reviewedAt: kycDocuments.reviewedAt,
          rejectionReason: kycDocuments.rejectionReason,
          createdAt: kycDocuments.createdAt,
          userEmail: users.email,
          userName: users.name,
        })
        .from(kycDocuments)
        .innerJoin(users, eq(kycDocuments.userId, users.id))
        .where(
          and(
            eq(kycDocuments.status, 'PENDING'),
            inArray(kycDocuments.userId, childIds)
          )
        )
        .orderBy(desc(kycDocuments.createdAt));

      // Attach a viewable URL for frontend to display the file
      const docsWithUrl = docs.map((d) => ({
        ...d,
        fileUrl: `/api/kyc/file/${d.id}`,
      }));

      res.json({ documents: docsWithUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /api/kyc/:docId/review — parent approve/reject document of direct child
router.patch(
  '/:docId/review',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const body = reviewSchema.parse(req.body);
      const { docId } = req.params as { [key: string]: string };

      const [doc] = await db
        .select({
          id: kycDocuments.id,
          userId: kycDocuments.userId,
          status: kycDocuments.status,
        })
        .from(kycDocuments)
        .where(eq(kycDocuments.id, docId));

      if (!doc) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      // Validate exactly direct parent-child relationship
      const [owner] = await db.select({ parentId: users.parentId }).from(users).where(eq(users.id, doc.userId));
      if (!owner || owner.parentId !== req.user!.userId) {
        res.status(403).json({ error: 'You can only review KYC documents of your direct children' });
        return;
      }

      await db
        .update(kycDocuments)
        .set({
          status: body.action,
          reviewedBy: req.user!.userId,
          reviewedAt: new Date(),
          rejectionReason: body.rejectionReason || null,
        })
        .where(eq(kycDocuments.id, docId));

      // Check if all required docs are approved → update user KYC status
      if (body.action === 'APPROVED') {
        const allDocs = await db
          .select()
          .from(kycDocuments)
          .where(eq(kycDocuments.userId, doc.userId));

        const allApproved = allDocs.every((d) => d.id === docId || d.status === 'APPROVED');
        if (allApproved && allDocs.length >= 1) {
          await db
            .update(users)
            .set({ kycStatus: 'APPROVED', isActive: true, updatedAt: new Date() })
            .where(eq(users.id, doc.userId));
        }
      } else {
        await db
          .update(users)
          .set({ kycStatus: 'REJECTED', updatedAt: new Date() })
          .where(eq(users.id, doc.userId));
      }

      res.json({ message: `Document ${body.action.toLowerCase()} successfully` });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
