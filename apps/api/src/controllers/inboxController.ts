import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { inboxIntelligenceService } from '../services/email/inboxIntelligence';
import { inboxRepository } from '../repositories/prismaRepository';
import { inboxSyncWorker } from '../workers/inboxSyncWorker';

export const syncInbox = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';

  try {
    const result = await inboxSyncWorker.processSyncJob({ userId, maxResults: 10 });
    return res.json({
      message: `Inbox sync completed with status: ${result.status}`,
      syncedCount: result.syncedMessagesCount,
      status: result.status
    });
  } catch (err: any) {
    if (err.name === 'ProviderAuthError') {
      return res.status(401).json({ error: err.message, status: 'REAUTH_REQUIRED' });
    }
    if (err.name === 'ProviderRateLimitError') {
      return res.status(429).json({ error: err.message, status: 'RATE_LIMITED' });
    }
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

    const matchResult = await inboxIntelligenceService.matchApplicationAdvanced(
      userId, 
      { senderEmail: senderEmail || 'hr@company.com', subject, body, threadId },
      extracted
    );

    const proposal = await inboxIntelligenceService.createProposal(
      userId,
      extracted,
      matchResult.application,
      undefined,
      matchResult.matchQuality,
      matchResult.matchReason
    );

    return res.json({
      message: `AI Detected ${extracted.category}: Proposed update to ${proposal.proposedStatus}`,
      proposal,
      extracted,
      matchQuality: matchResult.matchQuality,
      matchReason: matchResult.matchReason
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
  const userId = req.user?.id || 'demo-user-123';
  const proposalId = req.params.id || req.body.proposalId;

  if (!proposalId) {
    return res.status(400).json({ error: 'proposalId is required' });
  }

  try {
    const existing = await inboxRepository.findProposalById(proposalId) || inboxIntelligenceService.proposedUpdatesMap.get(proposalId);
    if (existing && existing.userId && existing.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized proposal access' });
    }

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
  const proposalId = req.params.id || req.body.proposalId;

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
