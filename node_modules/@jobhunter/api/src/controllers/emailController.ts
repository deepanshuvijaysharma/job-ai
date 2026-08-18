import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { emailOAuthService } from '../services/email/emailOAuthService';

export const getGmailAuthUrl = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const result = emailOAuthService.getGmailAuthUrl(userId);
  return res.json(result);
};

export const getOutlookAuthUrl = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const result = emailOAuthService.getOutlookAuthUrl(userId);
  return res.json(result);
};

export const handleOAuthCallback = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const { provider } = req.params;
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'OAuth authorization code parameter is required' });
  }

  if (!state) {
    return res.status(400).json({ error: 'OAuth state parameter is required' });
  }

  try {
    const account = await emailOAuthService.handleOAuthCallback(
      userId,
      provider as 'gmail' | 'outlook',
      String(code),
      String(state)
    );
    return res.json({
      message: `${provider.toUpperCase()} OAuth connected successfully!`,
      account: {
        id: account.id,
        provider: account.provider,
        emailAddress: account.emailAddress,
        isConnected: account.isConnected
      }
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'OAuth authentication failed' });
  }
};

export const getConnectedAccounts = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const accounts = await emailOAuthService.getUserConnectedAccounts(userId);
  return res.json(accounts);
};

export const sendTestEmail = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const userEmail = req.user?.email || 'deepanshu@example.com';
  const { accountId, recipientEmail } = req.body;

  // Default recipient MUST be the authenticated user's verified email address
  const recipient = recipientEmail || userEmail;

  try {
    const result = await emailOAuthService.sendTestEmail(userId, recipient, accountId);
    return res.json({
      message: `Test email successfully sent to ${recipient}`,
      result
    });
  } catch (err: any) {
    const errorMsg = err.message || 'Failed to send test email';
    const status = errorMsg.includes('NOT_CONFIGURED') ? 400 : 500;
    return res.status(status).json({ error: errorMsg });
  }
};

export const dispatchApprovedEmail = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const { messageId } = req.body;

  if (!messageId) {
    return res.status(400).json({ error: 'messageId is required' });
  }

  try {
    const log = await emailOAuthService.dispatchApprovedOutreach(userId, messageId);
    return res.json({
      message: 'Approved outreach message dispatched successfully!',
      log
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to dispatch approved email' });
  }
};

export const disconnectAccount = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'demo-user-123';
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Account ID parameter is required' });
  }

  const success = await emailOAuthService.disconnectAccount(userId, id);
  return res.json({ success, message: 'Email account disconnected successfully' });
};
