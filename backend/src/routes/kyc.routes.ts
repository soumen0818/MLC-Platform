import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';
import { db } from '../db';
import { kycDocuments, users } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

const uploadSchema = z.object({
  docType: z.enum(['AADHAAR_FRONT', 'AADHAAR_BACK', 'PAN', 'GST', 'SELFIE', 'CANCELLED_CHEQUE']),
  fileUrl: z.string().url(),
});

const reviewSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
});

// POST /api/kyc/upload — upload KYC document
router.post('/upload', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = uploadSchema.parse(req.body);

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
      // Update existing
      await db
        .update(kycDocuments)
        .set({
          fileUrl: body.fileUrl,
          status: 'PENDING',
          rejectionReason: null,
        })
        .where(eq(kycDocuments.id, existing[0].id));
    } else {
      await db.insert(kycDocuments).values({
        userId: req.user!.userId,
        docType: body.docType,
        fileUrl: body.fileUrl,
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

// GET /api/kyc/my — get my KYC documents
router.get('/my', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const docs = await db
      .select()
      .from(kycDocuments)
      .where(eq(kycDocuments.userId, req.user!.userId))
      .orderBy(kycDocuments.docType);

    res.json({ documents: docs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/kyc/pending — admin view all pending KYC
router.get(
  '/pending',
  roleMiddleware('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const docs = await db
        .select()
        .from(kycDocuments)
        .where(eq(kycDocuments.status, 'PENDING'))
        .orderBy(desc(kycDocuments.createdAt));

      res.json({ documents: docs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /api/kyc/:docId/review — admin approve/reject document
router.patch(
  '/:docId/review',
  roleMiddleware('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const body = reviewSchema.parse(req.body);
      const { docId } = req.params as { [key: string]: string };

      const [doc] = await db
        .select()
        .from(kycDocuments)
        .where(eq(kycDocuments.id, docId));

      if (!doc) {
        res.status(404).json({ error: 'Document not found' });
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

        const allApproved = allDocs.every(d => d.id === docId || d.status === 'APPROVED');
        if (allApproved && allDocs.length >= 2) {
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
