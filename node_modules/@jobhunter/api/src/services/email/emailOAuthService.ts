import { tokenEncryption } from './tokenEncryption';
import { oauthStateService } from './oauthStateService';
import { queuedEmailsMap } from '../../controllers/outreachController';
import { EmailAccountDTO, EmailDispatchLogDTO } from '@jobhunter/types';
import { emailRepository } from '../../repositories/prismaRepository';

export interface EmailAccountState {
  id: string;
  userId: string;
  provider: 'gmail' | 'outlook';
  emailAddress: string;
  encryptedAccessToken: string | null;
  encryptedRefreshToken: string | null;
  expiresAt?: string | null;
  isDefault: boolean;
  isConnected: boolean;
  lastTestedAt?: string | null;
  dailySentCount: number;
  createdAt: string;
  updatedAt?: string;
}

export class EmailOAuthService {
  private localAccountsCache: Map<string, EmailAccountState[]> = new Map();
  public dispatchLogs: EmailDispatchLogDTO[] = [];

  // 1. Gmail OAuth URL Generator
  public getGmailAuthUrl(userId: string): { url: string | null; status: 'CONFIGURED' | 'NOT_CONFIGURED' } {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const redirectUri = process.env.GMAIL_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return { url: null, status: 'NOT_CONFIGURED' };
    }

    const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email');
    const signedState = oauthStateService.generateState(userId, 'gmail');

    const url = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${signedState}&access_type=offline&prompt=consent`;
    return { url, status: 'CONFIGURED' };
  }

  // 2. Microsoft OAuth URL Generator
  public getOutlookAuthUrl(userId: string): { url: string | null; status: 'CONFIGURED' | 'NOT_CONFIGURED' } {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
    const tenant = process.env.MICROSOFT_TENANT_ID || 'common';

    if (!clientId || !redirectUri) {
      return { url: null, status: 'NOT_CONFIGURED' };
    }

    const scope = encodeURIComponent('Mail.Send User.Read offline_access');
    const signedState = oauthStateService.generateState(userId, 'outlook');

    const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${signedState}`;
    return { url, status: 'CONFIGURED' };
  }

  // 3. Process OAuth Callback with Cryptographic State Validation & Real Token Exchange (Zero Production Credential Manufacture)
  public async handleOAuthCallback(
    userId: string,
    provider: 'gmail' | 'outlook',
    code: string,
    stateToken: string
  ): Promise<EmailAccountState> {
    if (!code) {
      throw new Error('Authorization code is required');
    }

    // Cryptographically validate OAuth state (HMAC + 10-minute expiry + User match)
    const stateValidation = oauthStateService.validateState(stateToken, userId, provider);
    if (!stateValidation.isValid) {
      throw new Error(`OAuth Security Validation Failed: ${stateValidation.error}`);
    }

    let accessToken: string;
    let refreshToken: string | null = null;
    let emailAddress: string;
    let expiresInSeconds = 3600;

    // Real Token Exchange Execution
    if (provider === 'gmail') {
      const clientId = process.env.GMAIL_CLIENT_ID;
      const clientSecret = process.env.GMAIL_CLIENT_SECRET;
      const redirectUri = process.env.GMAIL_REDIRECT_URI;

      if (!clientId || !clientSecret || !redirectUri) {
        throw new Error('NOT_CONFIGURED: Gmail OAuth credentials are missing from server configuration');
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`Gmail OAuth token exchange failed: HTTP ${tokenRes.status} - ${errText}`);
      }

      const data = await tokenRes.json() as any;
      accessToken = data.access_token;
      refreshToken = data.refresh_token || null;
      expiresInSeconds = data.expires_in || 3600;

      // Fetch verified user email from Google UserInfo API
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!userInfoRes.ok) {
        throw new Error('Failed to fetch verified user email address from Google API');
      }

      const userInfo = await userInfoRes.json() as any;
      if (!userInfo.email) {
        throw new Error('Google UserInfo API did not return a verified email address');
      }
      emailAddress = userInfo.email;

    } else {
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
      const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
      const tenant = process.env.MICROSOFT_TENANT_ID || 'common';

      if (!clientId || !clientSecret || !redirectUri) {
        throw new Error('NOT_CONFIGURED: Microsoft OAuth credentials are missing from server configuration');
      }

      const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`Microsoft OAuth token exchange failed: HTTP ${tokenRes.status} - ${errText}`);
      }

      const data = await tokenRes.json() as any;
      accessToken = data.access_token;
      refreshToken = data.refresh_token || null;
      expiresInSeconds = data.expires_in || 3600;

      // Fetch user profile from Microsoft Graph
      const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!profileRes.ok) {
        throw new Error('Failed to fetch user profile from Microsoft Graph API');
      }
      const profileData = await profileRes.json() as any;
      emailAddress = profileData.mail || profileData.userPrincipalName;
    }

    // Encrypt tokens before saving
    const encryptedAccessToken = tokenEncryption.encryptToken(accessToken);
    const encryptedRefreshToken = refreshToken ? tokenEncryption.encryptToken(refreshToken) : null;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    const accountId = `acc-${provider}-${Date.now()}`;

    const accountState: EmailAccountState = {
      id: accountId,
      userId,
      provider,
      emailAddress,
      encryptedAccessToken,
      encryptedRefreshToken,
      expiresAt,
      isDefault: true,
      isConnected: true,
      dailySentCount: 0,
      createdAt: new Date().toISOString()
    };

    // Persist to PostgreSQL database (Source of Truth)
    await emailRepository.upsertAccount({
      id: accountId,
      userId,
      provider,
      emailAddress,
      encryptedAccessToken,
      encryptedRefreshToken: encryptedRefreshToken || undefined,
      expiresAt: new Date(expiresAt),
      isDefault: true,
      isConnected: true,
      dailySentCount: 0
    });

    this.saveToLocalCache(accountState);
    return accountState;
  }

  public saveToLocalCache(account: EmailAccountState) {
    const userAccounts = this.localAccountsCache.get(account.userId) || [];
    const existingIndex = userAccounts.findIndex(a => a.id === account.id);
    if (account.isDefault) {
      userAccounts.forEach(a => { a.isDefault = false; });
    }
    if (existingIndex >= 0) {
      userAccounts[existingIndex] = account;
    } else {
      userAccounts.push(account);
    }
    this.localAccountsCache.set(account.userId, userAccounts);
  }

  // 4. PostgreSQL Refresh Token Execution
  public async refreshAccessToken(account: EmailAccountState): Promise<string> {
    if (!account.encryptedRefreshToken) {
      account.isConnected = false;
      throw new Error('REAUTH_REQUIRED: No refresh token available for account');
    }

    const rawRefreshToken = tokenEncryption.decryptToken(account.encryptedRefreshToken);
    if (!rawRefreshToken) {
      account.isConnected = false;
      throw new Error('REAUTH_REQUIRED: Refresh token decryption failed');
    }

    let newAccessToken: string;
    let expiresInSeconds = 3600;

    if (account.provider === 'gmail') {
      const clientId = process.env.GMAIL_CLIENT_ID;
      const clientSecret = process.env.GMAIL_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('NOT_CONFIGURED: Gmail credentials missing');
      }

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: rawRefreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!res.ok) {
        account.isConnected = false;
        throw new Error('REAUTH_REQUIRED: Google token refresh rejected');
      }

      const data = await res.json() as any;
      newAccessToken = data.access_token;
      expiresInSeconds = data.expires_in || 3600;
    } else {
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
      const tenant = process.env.MICROSOFT_TENANT_ID || 'common';

      if (!clientId || !clientSecret) {
        throw new Error('NOT_CONFIGURED: Microsoft credentials missing');
      }

      const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: rawRefreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!res.ok) {
        account.isConnected = false;
        throw new Error('REAUTH_REQUIRED: Microsoft token refresh rejected');
      }

      const data = await res.json() as any;
      newAccessToken = data.access_token;
      expiresInSeconds = data.expires_in || 3600;
    }

    account.encryptedAccessToken = tokenEncryption.encryptToken(newAccessToken);
    account.expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    await emailRepository.upsertAccount({
      id: account.id,
      userId: account.userId,
      provider: account.provider,
      emailAddress: account.emailAddress,
      encryptedAccessToken: account.encryptedAccessToken,
      encryptedRefreshToken: account.encryptedRefreshToken || undefined,
      expiresAt: new Date(account.expiresAt),
      isConnected: true
    });

    return newAccessToken;
  }

  // 5. Send Test Email (Calls Real Provider API or FAILS)
  public async sendTestEmail(userId: string, userVerifiedEmail: string, accountId?: string): Promise<{ success: boolean; messageId: string | null }> {
    const accounts = await this.getAccountsForUser(userId);
    const account = (accountId ? accounts.find(a => a.id === accountId) : null) || accounts.find(a => a.isDefault) || accounts[0];

    if (!account || !account.isConnected || !account.encryptedAccessToken) {
      throw new Error('NOT_CONFIGURED: No active, connected Gmail or Outlook OAuth account found.');
    }

    const recipient = userVerifiedEmail || account.emailAddress;
    const subject = 'JobHunter AI Outreach Connection Test';
    const body = 'This is an automated connection test sent from your JobHunter AI platform to verify email dispatch connectivity.';

    let rawToken = tokenEncryption.decryptToken(account.encryptedAccessToken);
    if (account.expiresAt && new Date(account.expiresAt).getTime() <= Date.now()) {
      rawToken = await this.refreshAccessToken(account);
    }

    let externalId: string | null = null;
    if (account.provider === 'gmail') {
      externalId = await this.sendViaGmailApi(rawToken, recipient, subject, body);
    } else {
      externalId = await this.sendViaMicrosoftGraphApi(rawToken, recipient, subject, body);
    }

    account.lastTestedAt = new Date().toISOString();
    await emailRepository.upsertAccount({
      id: account.id,
      userId: account.userId,
      provider: account.provider,
      emailAddress: account.emailAddress,
      lastTestedAt: new Date(account.lastTestedAt)
    });

    return {
      success: true,
      messageId: externalId
    };
  }

  // 6. Approved Recruiter Outreach Dispatcher (Persisted to PostgreSQL)
  public async dispatchApprovedOutreach(userId: string, messageId: string): Promise<EmailDispatchLogDTO> {
    const queuedEmail = queuedEmailsMap.get(messageId);

    if (!queuedEmail) {
      throw new Error('Outreach message not found in approval queue');
    }

    if (queuedEmail.userId !== userId) {
      throw new Error('Unauthorized attempt to dispatch recruiter email');
    }

    // MANDATORY HUMAN APPROVAL GUARDRAIL
    if (!queuedEmail.isApproved) {
      throw new Error('Approval Required: Recruiter outreach email has not been approved by user');
    }

    // Idempotency / Duplicate Protection Check
    if (queuedEmail.sentAt) {
      throw new Error('Duplicate Protection: Outreach email has already been dispatched');
    }

    const accounts = await this.getAccountsForUser(userId);
    const account = accounts.find(a => a.isDefault) || accounts[0];

    if (!account || !account.isConnected || !account.encryptedAccessToken) {
      throw new Error('NOT_CONFIGURED: No connected email account found to send outreach message');
    }

    // Count today's successful sends from PostgreSQL database
    const todaySends = await emailRepository.countTodaySuccessfulSends(account.id);
    if (todaySends >= 10) {
      throw new Error('Daily Rate Limit Exceeded: Maximum 10 successful recruiter outreach emails per day limit reached.');
    }

    let rawToken = tokenEncryption.decryptToken(account.encryptedAccessToken);
    if (account.expiresAt && new Date(account.expiresAt).getTime() <= Date.now()) {
      rawToken = await this.refreshAccessToken(account);
    }

    const recipient = queuedEmail.recruiterEmail;
    if (!recipient) {
      throw new Error('Recruiter recipient email address is required');
    }

    try {
      let externalId: string | null = null;

      if (account.provider === 'gmail') {
        externalId = await this.sendViaGmailApi(rawToken, recipient, queuedEmail.subject, queuedEmail.body);
      } else {
        externalId = await this.sendViaMicrosoftGraphApi(rawToken, recipient, queuedEmail.subject, queuedEmail.body);
      }

      const nowStr = new Date().toISOString();
      queuedEmail.sentAt = nowStr;

      // Persist successful dispatch to PostgreSQL via Prisma
      await emailRepository.recordDispatchMessage({
        id: messageId,
        accountId: account.id,
        recruiterId: queuedEmail.recruiterId,
        applicationId: queuedEmail.jobId,
        subject: queuedEmail.subject,
        body: queuedEmail.body,
        isApproved: true,
        approvedAt: new Date(),
        sentAt: new Date(nowStr),
        status: 'SENT',
        externalMessageId: externalId,
        failureReason: null
      });

      const dispatchLog: EmailDispatchLogDTO = {
        id: `dispatch-${Date.now()}`,
        userId,
        messageId,
        recipient,
        subject: queuedEmail.subject,
        provider: account.provider,
        externalMessageId: externalId,
        sentAt: queuedEmail.sentAt,
        status: 'SENT',
        failureReason: null
      };

      this.dispatchLogs.push(dispatchLog);
      return dispatchLog;

    } catch (err: any) {
      const nowStr = new Date().toISOString();
      const sanitizedReason = err.message || 'Provider HTTP request failed';

      // Persist failed dispatch to PostgreSQL via Prisma (sentAt = null, externalMessageId = null)
      await emailRepository.recordDispatchMessage({
        id: messageId,
        accountId: account.id,
        recruiterId: queuedEmail.recruiterId,
        applicationId: queuedEmail.jobId,
        subject: queuedEmail.subject,
        body: queuedEmail.body,
        isApproved: true,
        approvedAt: new Date(),
        sentAt: undefined,
        failedAt: new Date(nowStr),
        status: 'FAILED',
        externalMessageId: null,
        failureReason: sanitizedReason
      });

      const failedLog: EmailDispatchLogDTO = {
        id: `dispatch-failed-${Date.now()}`,
        userId,
        messageId,
        recipient,
        subject: queuedEmail.subject,
        provider: account.provider,
        externalMessageId: null,
        sentAt: null,
        failedAt: nowStr,
        status: 'FAILED',
        failureReason: sanitizedReason
      };

      this.dispatchLogs.push(failedLog);
      throw new Error(`Email Dispatch Failed: ${sanitizedReason}`);
    }
  }

  // Real Gmail API Sender (Returns actual data.id or throws error)
  private async sendViaGmailApi(accessToken: string, to: string, subject: string, body: string): Promise<string> {
    const rawMessage = [
      `To: ${to}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${subject}`,
      '',
      body
    ].join('\r\n');

    const encodedMessage = Buffer.from(rawMessage).toString('base64url');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: encodedMessage })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gmail API HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json() as any;
    if (!data.id) {
      throw new Error('Gmail API response did not return a valid message ID');
    }

    return data.id; // Actual provider message ID
  }

  // Real Microsoft Graph API Sender (HTTP 202 Accepted -> externalMessageId = null)
  private async sendViaMicrosoftGraphApi(accessToken: string, to: string, subject: string, body: string): Promise<string | null> {
    const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'Text', content: body },
          toRecipients: [{ emailAddress: { address: to } }]
        },
        saveToSentItems: true
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Microsoft Graph HTTP ${res.status}: ${errText}`);
    }

    // Graph sendMail returns 202 Accepted without body ID -> return null (no synthetic IDs)
    return null;
  }

  // PostgreSQL Accounts Retriever
  public async getAccountsForUser(userId: string): Promise<EmailAccountState[]> {
    const dbAccounts = await emailRepository.findAccountsByUserId(userId);
    if (dbAccounts && dbAccounts.length > 0) {
      return dbAccounts.map(acc => ({
        id: acc.id,
        userId: acc.userId,
        provider: acc.provider as 'gmail' | 'outlook',
        emailAddress: acc.emailAddress,
        encryptedAccessToken: acc.encryptedAccessToken || null,
        encryptedRefreshToken: acc.encryptedRefreshToken || null,
        expiresAt: acc.expiresAt ? acc.expiresAt.toISOString() : null,
        isDefault: acc.isDefault,
        isConnected: acc.isConnected,
        lastTestedAt: acc.lastTestedAt ? acc.lastTestedAt.toISOString() : null,
        dailySentCount: acc.dailySentCount,
        createdAt: acc.createdAt.toISOString()
      }));
    }

    return this.localAccountsCache.get(userId) || [];
  }

  // Get Connected Accounts (Tokens NEVER exposed in response payload!)
  public async getUserConnectedAccounts(userId: string): Promise<EmailAccountDTO[]> {
    const accounts = await this.getAccountsForUser(userId);
    return accounts.map(acc => ({
      id: acc.id,
      userId: acc.userId,
      provider: acc.provider,
      emailAddress: acc.emailAddress,
      isDefault: acc.isDefault,
      isConnected: acc.isConnected,
      lastTestedAt: acc.lastTestedAt || undefined,
      createdAt: acc.createdAt
    }));
  }

  // Disconnect Connected Account
  public async disconnectAccount(userId: string, accountId: string): Promise<boolean> {
    await emailRepository.disconnectAccount(accountId);
    const cached = this.localAccountsCache.get(userId) || [];
    const filtered = cached.filter(a => a.id !== accountId);
    this.localAccountsCache.set(userId, filtered);
    return true;
  }
}

export const emailOAuthService = new EmailOAuthService();
