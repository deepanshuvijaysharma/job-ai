import { tokenEncryption } from './tokenEncryption';
import { memoryStore } from '../store';
import { queuedEmailsMap } from '../../controllers/outreachController';

export interface EmailAccountState {
  id: string;
  userId: string;
  provider: 'gmail' | 'outlook' | 'smtp';
  emailAddress: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  isDefault: boolean;
  isConnected: boolean;
  lastTestedAt?: string;
  createdAt: string;
}

export interface EmailDispatchLog {
  id: string;
  userId: string;
  messageId: string;
  recipient: string;
  subject: string;
  provider: string;
  externalMessageId: string;
  sentAt: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
}

export class EmailOAuthService {
  private userAccounts: Map<string, EmailAccountState[]> = new Map();
  public dispatchLogs: EmailDispatchLog[] = [];

  // 1. Gmail OAuth URL Generation
  public getGmailAuthUrl(userId: string): string {
    const clientId = process.env.GMAIL_CLIENT_ID || 'demo-gmail-client-id.apps.googleusercontent.com';
    const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/email/oauth/gmail/callback';
    const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email');
    const state = Buffer.from(JSON.stringify({ userId, csrfToken: Date.now() })).toString('base64');

    return `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}&access_type=offline&prompt=consent`;
  }

  // 2. Outlook OAuth URL Generation
  public getOutlookAuthUrl(userId: string): string {
    const clientId = process.env.MICROSOFT_CLIENT_ID || 'demo-microsoft-client-id';
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:5000/api/email/oauth/outlook/callback';
    const scope = encodeURIComponent('Mail.Send User.Read offline_access');
    const state = Buffer.from(JSON.stringify({ userId, csrfToken: Date.now() })).toString('base64');

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;
  }

  // 3. Process OAuth Code Callback & Encrypt Tokens
  public async handleOAuthCallback(userId: string, provider: 'gmail' | 'outlook', code: string, userEmail?: string): Promise<EmailAccountState> {
    if (!code) {
      throw new Error('Authorization code is required');
    }

    const mockAccessToken = `ya29.a0-${provider}-access-token-${Date.now()}`;
    const mockRefreshToken = `1//04-${provider}-refresh-token-${Date.now()}`;
    const emailAddress = userEmail || (provider === 'gmail' ? 'deepanshu.gmail@example.com' : 'deepanshu.outlook@example.com');

    // Encrypt tokens securely before saving
    const encryptedAccessToken = tokenEncryption.encryptToken(mockAccessToken);
    const encryptedRefreshToken = tokenEncryption.encryptToken(mockRefreshToken);

    const accountId = `acc-${provider}-${Date.now()}`;
    const accountState: EmailAccountState = {
      id: accountId,
      userId,
      provider,
      emailAddress,
      encryptedAccessToken,
      encryptedRefreshToken,
      isDefault: true,
      isConnected: true,
      createdAt: new Date().toISOString()
    };

    const existingList = this.userAccounts.get(userId) || [];
    existingList.push(accountState);
    this.userAccounts.set(userId, existingList);

    return accountState;
  }

  // 4. Safe Test Email Mechanism
  public async sendTestEmail(userId: string, accountId: string, testRecipientEmail: string): Promise<{ success: boolean; messageId: string }> {
    const accounts = this.userAccounts.get(userId) || [];
    const account = accounts.find(a => a.id === accountId) || accounts[0];

    if (!account || !account.isConnected) {
      throw new Error('Connected email account not found. Please connect Gmail or Outlook first.');
    }

    // Decrypt access token for sending request
    const decryptedToken = tokenEncryption.decryptToken(account.encryptedAccessToken);
    if (!decryptedToken) {
      throw new Error('Failed to decrypt OAuth access token for sending');
    }

    const messageId = `msg-test-${Date.now()}`;
    const log: EmailDispatchLog = {
      id: `log-${Date.now()}`,
      userId,
      messageId,
      recipient: testRecipientEmail,
      subject: 'JobHunter AI Outreach Verification Test',
      provider: account.provider,
      externalMessageId: `ext-${Date.now()}`,
      sentAt: new Date().toISOString(),
      status: 'SENT'
    };

    this.dispatchLogs.push(log);
    account.lastTestedAt = new Date().toISOString();

    return {
      success: true,
      messageId
    };
  }

  // 5. Approved Recruiter Outreach Dispatcher (Enforces isApproved === true)
  public async dispatchApprovedOutreach(userId: string, messageId: string): Promise<EmailDispatchLog> {
    const queuedEmail = queuedEmailsMap.get(messageId);

    if (!queuedEmail) {
      throw new Error('Outreach message not found in queue');
    }

    if (queuedEmail.userId !== userId) {
      throw new Error('Unauthorized attempt to dispatch outreach message');
    }

    // Rule 7 Enforcement: No email may be sent automatically unless explicitly approved!
    if (!queuedEmail.isApproved) {
      throw new Error('Approval Required: Recruiter outreach email has not been approved by user');
    }

    if (queuedEmail.sentAt) {
      throw new Error('Duplicate Protection: Outreach email has already been dispatched');
    }

    const accounts = this.userAccounts.get(userId) || [];
    const account = accounts.find(a => a.isDefault) || accounts[0];

    const dispatchLog: EmailDispatchLog = {
      id: `dispatch-${Date.now()}`,
      userId,
      messageId,
      recipient: queuedEmail.recruiterEmail || 'recruiter@company.com',
      subject: queuedEmail.subject,
      provider: account ? account.provider : 'gmail_oauth',
      externalMessageId: `ext-${Date.now()}`,
      sentAt: new Date().toISOString(),
      status: 'SENT'
    };

    queuedEmail.sentAt = dispatchLog.sentAt;
    this.dispatchLogs.push(dispatchLog);

    return dispatchLog;
  }

  // 6. Get User Accounts (Excludes sensitive tokens from frontend payload)
  public getUserConnectedAccounts(userId: string) {
    const accounts = this.userAccounts.get(userId) || [];
    return accounts.map(acc => ({
      id: acc.id,
      provider: acc.provider,
      emailAddress: acc.emailAddress,
      isDefault: acc.isDefault,
      isConnected: acc.isConnected,
      lastTestedAt: acc.lastTestedAt,
      createdAt: acc.createdAt
      // encryptedAccessToken and encryptedRefreshToken are NEVER exposed to frontend!
    }));
  }
}

export const emailOAuthService = new EmailOAuthService();
