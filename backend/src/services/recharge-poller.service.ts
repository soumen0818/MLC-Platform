import cron from 'node-cron';
import { db } from '../db';
import { rechargeTransactions } from '../db/schema';
import { eq, lte, and } from 'drizzle-orm';
import { RechargeService } from './recharge.service';
import { CommissionService } from './commission.service';
import { WalletService } from './wallet.service';

const log = (msg: string) => console.log(`[RechargePoller ${new Date().toISOString()}] ${msg}`);

/**
 * Polls BharatPays for the status of PENDING recharge transactions.
 * Runs every 5 minutes. Safe to run concurrently — uses idempotency checks.
 */
export class RechargePollerService {
  private static isRunning = false;

  /**
   * Main poll cycle — finds all PENDING txns older than 2 minutes (to avoid race with live requests)
   * and resolves them atomically using BharatPays status-check API.
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
      // Find PENDING transactions that are at least 2 minutes old
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

      // Separate real BharatPays txns from legacy/orphaned demo txns
      const realTxns = pendingTxns.filter(t => t.apiTxnId && !t.apiTxnId.startsWith('DEMO-'));
      const orphanedTxns = pendingTxns.filter(t => !t.apiTxnId || t.apiTxnId.startsWith('DEMO-'));

      // Warn about any orphaned transactions (should not exist in production)
      if (orphanedTxns.length > 0) {
        log(`⚠️ Found ${orphanedTxns.length} orphaned/demo transaction(s) with no valid API txn ID. These require manual review.`);
        for (const txn of orphanedTxns) {
          log(`  → Orphaned txn ${txn.id} (apiTxnId: ${txn.apiTxnId || 'null'}) — skipping auto-resolve`);
          skipped++;
        }
      }

      // For real BharatPays transactions, use the status-check API
      if (realTxns.length > 0) {
        const apiToken = process.env.BHARATPAYS_API_TOKEN;

        if (!apiToken) {
          log('No BHARATPAYS_API_TOKEN set — skipping real transaction polling.');
          skipped = realTxns.length;
        } else {
          for (const txn of realTxns) {
            try {
              // Format the recharge date as YYYY-MM-DD
              const rechargeDate = txn.createdAt.toISOString().split('T')[0];

              // Use our DB txn ID as reference_id (that's what we sent to BharatPays)
              const statusResult = await RechargeService.checkStatus(txn.id, rechargeDate);

              if (statusResult.status === 'PENDING') {
                skipped++;
                continue; // Still processing — check next cycle
              }

              if (statusResult.status === 'SUCCESS') {
                await db.transaction(async (dbTx) => {
                  await dbTx
                    .update(rechargeTransactions)
                    .set({
                      status: 'SUCCESS',
                      apiTxnId: statusResult.txnId || txn.apiTxnId,
                      apiResponseRaw: statusResult.raw || txn.apiResponseRaw,
                      updatedAt: new Date(),
                    })
                    .where(eq(rechargeTransactions.id, txn.id));

                  await CommissionService.distributeCommissions(
                    txn.id,
                    txn.retailerId,
                    parseFloat(txn.amount),
                    txn.operator,
                    dbTx
                  );
                });
                resolved++;
                log(`Resolved txn ${txn.id} → SUCCESS (via status-check), commissions distributed`);

              } else if (statusResult.status === 'FAILED') {
                await db.transaction(async (dbTx) => {
                  await dbTx
                    .update(rechargeTransactions)
                    .set({
                      status: 'FAILED',
                      failureReason: statusResult.reason || 'Confirmed FAILED via BharatPays status-check',
                      apiResponseRaw: statusResult.raw || txn.apiResponseRaw,
                      updatedAt: new Date(),
                    })
                    .where(eq(rechargeTransactions.id, txn.id));

                  // Refund the retailer
                  await WalletService.creditWallet(
                    txn.retailerId,
                    parseFloat(txn.amount),
                    'REVERSAL',
                    txn.id,
                    'Refund — recharge confirmed failed via status-check',
                    dbTx,
                    'MAIN'
                  );

                  await CommissionService.reverseCommissions(txn.id, dbTx);
                });
                resolved++;
                log(`Resolved txn ${txn.id} → FAILED (via status-check), retailer refunded`);
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
    log('Starting BharatPays recharge status poller (every 5 minutes)...');

    // Run immediately on startup to catch any leftover pending from previous sessions
    RechargePollerService.runPollCycle();

    // Schedule: every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      RechargePollerService.runPollCycle();
    });

    log('Poller scheduled. ✅');
  }
}
