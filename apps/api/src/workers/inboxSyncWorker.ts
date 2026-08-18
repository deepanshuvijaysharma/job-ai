import { emailRepository, inboxRepository } from '../repositories/prismaRepository';
import { InboxProviderFactory, ProviderAuthError, ProviderRateLimitError } from '../services/email/inboxProvider';
import { inboxIntelligenceService } from '../services/email/inboxIntelligence';

export interface InboxSyncTaskPayload {
  userId: string;
  accountId?: string;
  maxResults?: number;
}

export class InboxSyncWorker {
  /**
   * Execute background inbox synchronization for user connected accounts
   */
  public async processSyncJob(payload: InboxSyncTaskPayload): Promise<{ syncedMessagesCount: number; status: string }> {
    const { userId, accountId, maxResults = 10 } = payload;
    const accounts = await emailRepository.findAccountsByUserId(userId);

    const targetAccounts = accountId ? accounts.filter(a => a.id === accountId) : accounts;
    if (!targetAccounts.length) {
      return { syncedMessagesCount: 0, status: 'NO_ACCOUNTS' };
    }

    let totalSyncedMessages = 0;

    for (const account of targetAccounts) {
      await inboxRepository.updateAccountSyncState(account.id, {
        inboxSyncStatus: 'SYNCING',
        inboxSyncError: undefined
      });

      const provider = InboxProviderFactory.getProvider(account.provider);

      try {
        const syncResult = await provider.fetchIncremental({
          userId,
          accountId: account.id,
          provider: account.provider as any,
          accessToken: (account as any).encryptedAccessToken || undefined,
          historyId: (account as any).gmailHistoryId || undefined,
          deltaLink: (account as any).outlookDeltaLink || undefined,
          maxResults
        });

        for (const msg of syncResult.messages) {
          // Atomically deduplicate inbound message identity in PostgreSQL
          await inboxRepository.upsertInboxMessage({
            id: msg.id,
            accountId: account.id,
            externalMessageId: msg.externalMessageId,
            threadId: msg.threadId,
            senderEmail: msg.senderEmail,
            senderName: msg.senderName,
            subject: msg.subject,
            body: msg.body,
            provider: account.provider.toUpperCase()
          });

          // Classify and match application
          const extracted = await inboxIntelligenceService.processIncomingEmail({
            senderEmail: msg.senderEmail,
            senderName: msg.senderName,
            subject: msg.subject,
            body: msg.body
          });

          const matchResult = await inboxIntelligenceService.matchApplicationAdvanced(userId, msg, extracted);

          await inboxIntelligenceService.createProposal(
            userId,
            extracted,
            matchResult.application,
            msg.id,
            matchResult.matchQuality,
            matchReason(matchResult)
          );

          totalSyncedMessages++;
        }

        // Persist new cursor and mark SUCCESS
        const cursorData: any = {
          lastInboxSyncAt: new Date(),
          inboxSyncStatus: 'SUCCESS',
          inboxSyncError: undefined
        };

        if (account.provider.toLowerCase() === 'gmail' && syncResult.nextCursor) {
          cursorData.gmailHistoryId = syncResult.nextCursor;
        } else if (account.provider.toLowerCase() !== 'gmail' && syncResult.nextCursor) {
          cursorData.outlookDeltaLink = syncResult.nextCursor;
        }

        await inboxRepository.updateAccountSyncState(account.id, cursorData);
      } catch (err: any) {
        if (err instanceof ProviderAuthError) {
          await inboxRepository.updateAccountSyncState(account.id, {
            inboxSyncStatus: 'REAUTH_REQUIRED',
            inboxSyncError: err.message,
            lastInboxSyncAt: new Date()
          });
          throw err;
        }

        if (err instanceof ProviderRateLimitError) {
          await inboxRepository.updateAccountSyncState(account.id, {
            inboxSyncStatus: 'RATE_LIMITED',
            inboxSyncError: err.message,
            lastInboxSyncAt: new Date()
          });
          // Throw error to trigger BullMQ backoff retry without advancing cursor
          throw err;
        }

        await inboxRepository.updateAccountSyncState(account.id, {
          inboxSyncStatus: 'ERROR',
          inboxSyncError: err.message || 'Unknown inbox sync failure',
          lastInboxSyncAt: new Date()
        });
      }
    }

    return { syncedMessagesCount: totalSyncedMessages, status: 'SUCCESS' };
  }
}

function matchReason(res: any): string {
  if (res.matchQuality === 'AMBIGUOUS') {
    return 'Multiple active applications found: review required';
  }
  return res.matchReason || `Matched with ${res.matchQuality} confidence`;
}

export const inboxSyncWorker = new InboxSyncWorker();
