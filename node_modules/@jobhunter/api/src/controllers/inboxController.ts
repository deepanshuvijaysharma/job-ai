import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { inboxIntelligenceService } from '../services/email/inboxIntelligence';
import { emailRepository, inboxRepository } from '../repositories/prismaRepository';
import { InboxProviderFactory } from '../services/email/inboxProvider';

export const syncInbox = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';

  try {
    const connectedAccounts = await emailRepository.findAccountsByUserId(userId);
    let totalSynced = 0;

    for (const account of connectedAccounts) {
      const provider = InboxProviderFactory.getProvider(account.provider);
      const messages = await provider.fetchMessages({
        userId,
        accountId: account.id,
        provider: account.provider as any,
        accessToken: account.encryptedAccessToken || undefined,
        maxResults: 10
      });

      for (const msg of messages) {
        await inboxRepository.upsertInboxMessage({
          id: msg.id,
          accountId: account.id,
          externalMessageId: msg.externalMessageId,
          threadId: msg.threadId,
          senderEmail: msg.senderEmail,
          senderName: msg.senderName,
          subject: msg.subject,
          body: msg.body
        });

        // Run intelligence & generate proposal for each unread/fresh message
        const extracted = await inboxIntelligenceService.processIncomingEmail({
          senderEmail: msg.senderEmail,
          senderName: msg.senderName,
          subject: msg.subject,
          body: msg.body
        });

        const matchedApp = await inboxIntelligenceService.matchApplication(userId, msg, extracted);
        await inboxIntelligenceService.createProposal(userId, extracted, matchedApp, msg.id);
        totalSynced++;
      }
    }

    return res.json({
      message: `Inbox sync completed successfully. Synced ${totalSynced} inbound messages across ${connectedAccounts.length} connected accounts.`,
      syncedCount: totalSynced
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to sync inbox' });
  }
};

export const getMessages = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const proposals = await inboxRepository.findProposalsByUserId(userId);
  return res.json(proposals);
};

export const processEmail = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const { senderEmail, senderName, subject, body, threadId } = req.body;

  if (!subject || !body) {
    return res.status(400).json({ error: 'subject and body are required' });
  }

  try {
    const extracted = await inboxIntelligenceService.processIncomingEmail({
      senderEmail: senderEmail || 'hr@company.com',
      senderName: senderName || 'Recruiter',
      subject,
      body
    });

    const matchedApp = await inboxIntelligenceService.matchApplication(
      userId, 
      { senderEmail: senderEmail || 'hr@company.com', subject, body, threadId },
      extracted
    );

    const proposal = await inboxIntelligenceService.createProposal(userId, extracted, matchedApp);

    return res.json({
      message: `AI Detected ${extracted.category}: Proposed update to ${proposal.proposedStatus}`,
      proposal,
      extracted
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to process email' });
  }
};

export const getPendingProposals = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const dbProposals = await inboxRepository.findProposalsByUserId(userId, false);

  if (dbProposals && dbProposals.length > 0) {
    return res.json(dbProposals);
  }

  const memoryProposals = Array.from(inboxIntelligenceService.proposedUpdatesMap.values()).filter(
    p => p.userId === userId && !p.isConfirmed
  );
  return res.json(memoryProposals);
};

export const confirmProposal = async (req: AuthenticatedRequest, res: Response) => {
  const { proposalId } = req.body;

  if (!proposalId) {
    return res.status(400).json({ error: 'proposalId is required' });
  }

  try {
    const confirmed = await inboxIntelligenceService.confirmProposal(proposalId);
    return res.json({
      message: `Confirmed! Application pipeline updated to ${confirmed.proposedStatus}`,
      proposal: confirmed
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to confirm proposal' });
  }
};

export const rejectProposal = async (req: AuthenticatedRequest, res: Response) => {
  const { proposalId } = req.body;

  if (!proposalId) {
    return res.status(400).json({ error: 'proposalId is required' });
  }

  try {
    await inboxIntelligenceService.rejectProposal(proposalId);
    return res.json({
      message: `Proposal ${proposalId} rejected and dismissed.`
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to reject proposal' });
  }
};
