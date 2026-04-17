import cron from 'node-cron';
import { db } from '../db';
import { rechargeTransactions } from '../db/schema';
import { and, eq, lte } from 'drizzle-orm';
import { RechargeService } from './recharge.service';
import { RechargeProviderId } from './providers/types';

const log = (msg: string) => console.log(`[RechargePoller ${new Date().toISOString()}] ${msg}`);

export class RechargePollerService {
  private static isRunning = false;

  static async runPollCycle(): Promise<void> {
    if (RechargePollerService.isRunning) {
      log('Skipping because the previous cycle is still in progress.');
      return;
    }

    RechargePollerService.isRunning = true;
    let resolved = 0;
    let pending = 0;
    let skipped = 0;

    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const txns = await db
        .select()
        .from(rechargeTransactions)
        .where(
          and(
            eq(rechargeTransactions.status, 'PENDING'),
            lte(rechargeTransactions.createdAt, twoMinutesAgo)
          )
        );

      if (txns.length === 0) {
        log('No pending transactions to poll.');
        return;
      }

      log(`Checking ${txns.length} pending recharge(s).`);

      for (const txn of txns) {
        const providerId = txn.apiProvider as RechargeProviderId | null;
        if (!providerId) {
          skipped += 1;
          log(`Skipping ${txn.id} because no provider is recorded.`);
          continue;
        }

        try {
          const statusResult = await RechargeService.checkStatus(txn);

          if (statusResult.status === 'PENDING') {
            pending += 1;
            continue;
          }

          await RechargeService.applyResolution(txn.id, providerId, statusResult);
          resolved += 1;
          log(`Resolved ${txn.id} via ${providerId} -> ${statusResult.status}`);
        } catch (error: any) {
          skipped += 1;
          log(`Failed to poll ${txn.id}: ${error.message}`);
        }
      }

      log(`Cycle complete. Resolved: ${resolved}, Still pending: ${pending}, Skipped: ${skipped}`);
    } catch (error: any) {
      log(`Poller cycle error: ${error.message}`);
    } finally {
      RechargePollerService.isRunning = false;
    }
  }

  static start(): void {
    log('Starting multi-provider recharge status poller (every 5 minutes)...');

    RechargePollerService.runPollCycle();

    cron.schedule('*/5 * * * *', () => {
      RechargePollerService.runPollCycle();
    });

    log('Poller scheduled.');
  }
}
