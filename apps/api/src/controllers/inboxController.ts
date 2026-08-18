import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { inboxIntelligenceService } from '../services/email/inboxIntelligence';

export const processEmail = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const { senderEmail, senderName, subject, body } = req.body;

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

    const proposal = inboxIntelligenceService.createProposal(userId, extracted);

    return res.json({
      message: `AI Detected ${extracted.category}: Proposed update to ${proposal.proposedStatus}`,
      proposal
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to process email' });
  }
};

export const getPendingProposals = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const proposals = Array.from(inboxIntelligenceService.proposedUpdatesMap.values()).filter(
    p => p.userId === userId && !p.isConfirmed
  );
  return res.json(proposals);
};

export const confirmProposal = async (req: AuthenticatedRequest, res: Response) => {
  const { proposalId } = req.body;

  if (!proposalId) {
    return res.status(400).json({ error: 'proposalId is required' });
  }

  try {
    const confirmed = inboxIntelligenceService.confirmProposal(proposalId);
    return res.json({
      message: `Confirmed! Application pipeline updated to ${confirmed.proposedStatus}`,
      proposal: confirmed
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to confirm proposal' });
  }
};
