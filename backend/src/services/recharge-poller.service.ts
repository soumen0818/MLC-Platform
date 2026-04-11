import cron from 'node-cron';
import { db } from '../db';
import { rechargeTransactions } from '../db/schema';
import { eq, lte, and } from 'drizzle-orm';
import { RechargeService } from './recharge.service';
import { CommissionService } from './commission.service';
import { WalletService } from './wallet.service';

const log = (msg: string) => console.log(`[RechargePoller ${new Date().toISOString()}] ${msg}`);

/**
 * Polls Setu for the status of PENDING recharge transactions.
 * Runs every 5 minutes. Safe to run concurrently — uses idempotency checks.
 */
export class RechargePollerService {
  private static isRunning = false;

  /**
   * Check one PENDING transaction against Setu's status enquiry API
   */
  private static async enquireStatus(apiTxnId: string, bearerToken: string): Promise<'SUCCESS' | 'FAILED' | 'PENDING'> {
    const apiUrl = process.env.RECHARGE_API_URL;
    const clientId = process.env.RECHARGE_API_KEY;

    if (!apiUrl || !clientId) return 'PENDING'; // In demo mode, nothing to poll

    try {
      const res = await fetch(`${apiUrl}/api/v2/biller-payments/bbps/recharge/${apiTxnId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'X-Setu-Product-Instance-ID': clientId,
        },
      });

      const data: any = await res.json();
      const status = data?.payment?.status || data?.status;

      if (status === 'SUCCESS') return 'SUCCESS';
      if (status === 'FAILED' || status === 'REFUND') return 'FAILED';
      return 'PENDING';
    } catch {
      return 'PENDING'; // Network error — be conservative
    }
  }

  /**
   * Get a fresh Setu bearer token
   */
  private static async getSetuToken(): Promise<string | null> {
    const apiUrl = process.env.RECHARGE_API_URL;
    const clientId = process.env.RECHARGE_API_KEY;
    const clientSecret = process.env.RECHARGE_CLIENT_SECRET;

    if (!apiUrl || !clientId || !clientSecret) return null; // Demo mode

    try {
      const res = await fetch(`${apiUrl}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientID: clientId, secret: clientSecret }),
      });

      const data: any = await res.json();
      return data?.data?.token || null;
    } catch {
      return null;
    }
  }

  /**
   * Main poll cycle — finds all PENDING txns older than 2 minutes (to avoid race with live requests)
   * and resolves them atomically.
   */
  static async runPollCycle(): Promise<void> {
    if (RechargePollerService.isRunning) {
      log('Skipping — previous cycle still in progress.');
      return;
    }

    RechargePollerService.isRunning = true;
    let resolved = 0;
    let skipped = 0;

    try {
      // Find PENDING transactions that have a real Setu txn ID and are at least 2 minutes old
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

      const pendingTxns = await db
        .select()
        .from(rechargeTransactions)
        .where(
          and(
            eq(rechargeTransactions.status, 'PENDING'),
            lte(rechargeTransactions.createdAt, twoMinutesAgo)
          )
        );

      if (pendingTxns.length === 0) {
        log('No pending transactions to poll.');
        return;
      }

      log(`Found ${pendingTxns.length} pending transaction(s) to resolve.`);

      // Separate real Setu txns from demo mode txns
      const setuTxns = pendingTxns.filter(t => t.apiTxnId && !t.apiTxnId.startsWith('DEMO-'));
      const demoTxns = pendingTxns.filter(t => !t.apiTxnId || t.apiTxnId.startsWith('DEMO-'));

      // Auto-resolve demo-mode PENDING transactions as SUCCESS (for testing)
      for (const txn of demoTxns) {
        try {
          await db.transaction(async (dbTx) => {
            await dbTx
              .update(rechargeTransactions)
              .set({ status: 'SUCCESS', updatedAt: new Date() })
              .where(eq(rechargeTransactions.id, txn.id));

            await CommissionService.distributeCommissions(
              txn.id,
              txn.retailerId,
              parseFloat(txn.amount),
              txn.serviceType,
              dbTx
            );
          });
          resolved++;
          log(`[DEMO] Resolved pending txn ${txn.id} → SUCCESS`);
        } catch (err: any) {
          log(`[DEMO] Failed to resolve ${txn.id}: ${err.message}`);
        }
      }

      // For real Setu transactions, get a token and enquire
      if (setuTxns.length > 0) {
        const token = await RechargePollerService.getSetuToken();

        if (!token) {
          log('Could not obtain Setu auth token — skipping real transactions.');
          skipped = setuTxns.length;
        } else {
          for (const txn of setuTxns) {
            try {
              const enquiredStatus = await RechargePollerService.enquireStatus(txn.apiTxnId!, token);

              if (enquiredStatus === 'PENDING') {
                skipped++;
                continue; // Still processing — check next cycle
              }

              if (enquiredStatus === 'SUCCESS') {
                await db.transaction(async (dbTx) => {
                  await dbTx
                    .update(rechargeTransactions)
                    .set({ status: 'SUCCESS', updatedAt: new Date() })
                    .where(eq(rechargeTransactions.id, txn.id));

                  await CommissionService.distributeCommissions(
                    txn.id,
                    txn.retailerId,
                    parseFloat(txn.amount),
                    txn.serviceType,
                    dbTx
                  );
                });
                resolved++;
                log(`Resolved txn ${txn.id} (${txn.apiTxnId}) → SUCCESS, commissions distributed`);

              } else if (enquiredStatus === 'FAILED') {
                await db.transaction(async (dbTx) => {
                  await dbTx
                    .update(rechargeTransactions)
                    .set({ status: 'FAILED', failureReason: 'Confirmed FAILED via status enquiry', updatedAt: new Date() })
                    .where(eq(rechargeTransactions.id, txn.id));

                  // Refund the retailer
                  await WalletService.creditWallet(
                    txn.retailerId,
                    parseFloat(txn.amount),
                    'REVERSAL',
                    txn.id,
                    'Refund — recharge confirmed failed via status enquiry',
                    dbTx,
                    'MAIN' // Refunds always go to main wallet
                  );

                  await CommissionService.reverseCommissions(txn.id, dbTx);
                });
                resolved++;
                log(`Resolved txn ${txn.id} (${txn.apiTxnId}) → FAILED, retailer refunded`);
              }
            } catch (err: any) {
              log(`Error resolving txn ${txn.id}: ${err.message}`);
            }
          }
        }
      }

      log(`Cycle complete. Resolved: ${resolved}, Still pending: ${skipped}`);
    } catch (err: any) {
      log(`Poller cycle error: ${err.message}`);
    } finally {
      RechargePollerService.isRunning = false;
    }
  }

  /**
   * Start the background cron job — runs every 5 minutes
   */
  static start(): void {
    log('Starting recharge status poller (every 5 minutes)...');

    // Run immediately on startup to catch any leftover pending from previous sessions
    RechargePollerService.runPollCycle();

    // Schedule: every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      RechargePollerService.runPollCycle();
    });

    log('Poller scheduled. ✅');
  }
}
