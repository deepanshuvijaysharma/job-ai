import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';
import { tokenEncryption } from '../services/email/tokenEncryption';
import { emailOAuthService } from '../services/email/emailOAuthService';
import { oauthStateService } from '../services/email/oauthStateService';
import { queuedEmailsMap } from '../controllers/outreachController';
import { OutreachTemplateType } from '../services/outreach/emailGenerator';
import { emailRepository } from '../repositories/prismaRepository';

describe('JobHunter AI Step 7: Gmail & Outlook Integration Suite', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    jest.setTimeout(25000);
    memoryStore.clearAllData();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deepanshu@example.com', password: 'password123' });
    authToken = loginRes.body.token;
    userId = loginRes.body.user?.id || 'demo-user-123';
  });

  it('1. Missing Gmail credentials -> NOT_CONFIGURED', async () => {
    const origId = process.env.GMAIL_CLIENT_ID;
    delete process.env.GMAIL_CLIENT_ID;

    const res = await request(app)
      .get('/api/email/oauth/gmail/url')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('NOT_CONFIGURED');
    expect(res.body.url).toBeNull();

    process.env.GMAIL_CLIENT_ID = origId;
  });

  it('2. Missing Microsoft credentials -> NOT_CONFIGURED', async () => {
    const origId = process.env.MICROSOFT_CLIENT_ID;
    delete process.env.MICROSOFT_CLIENT_ID;

    const res = await request(app)
      .get('/api/email/oauth/outlook/url')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('NOT_CONFIGURED');
    expect(res.body.url).toBeNull();

    process.env.MICROSOFT_CLIENT_ID = origId;
  });

  it('3. OAuth state validation & forgery protection: Rejects invalid or forged OAuth state', () => {
    const validState = oauthStateService.generateState('demo-user-123', 'gmail');
    const validation = oauthStateService.validateState(validState, 'demo-user-123', 'gmail');
    expect(validation.isValid).toBe(true);

    const forgedState = validState.substring(0, validState.length - 4) + 'abcd';
    const forgedValidation = oauthStateService.validateState(forgedState, 'demo-user-123', 'gmail');
    expect(forgedValidation.isValid).toBe(false);

    const wrongUserValidation = oauthStateService.validateState(validState, 'hacker-user-999', 'gmail');
    expect(wrongUserValidation.isValid).toBe(false);
  });

  it('4. Real Token Security & AES Encryption: Correctly encrypts and decrypts OAuth tokens', () => {
    const rawToken = 'ya29.a0-secret-access-token-12345';
    const encrypted = tokenEncryption.encryptToken(rawToken);

    expect(encrypted).not.toBe(rawToken);
    expect(encrypted.includes(':')).toBe(true);

    const decrypted = tokenEncryption.decryptToken(encrypted);
    expect(decrypted).toBe(rawToken);
  });

  it('5. OAuth callback without state or with unconfigured credentials fails without creating fake account', async () => {
    const res = await request(app)
      .get('/api/email/oauth/gmail/callback?code=some-code')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('state parameter is required');
  });

  it('6. Test email with provider not configured -> Returns NOT_CONFIGURED error', async () => {
    const res = await request(app)
      .post('/api/email/test')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ recipientEmail: 'deepanshu@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('NOT_CONFIGURED');
  });

  it('7. Approval requirement guardrail: Rejects unapproved recruiter email dispatch with HTTP 400', async () => {
    const messageId = `msg-unapproved-${Date.now()}`;
    queuedEmailsMap.set(messageId, {
      id: messageId,
      userId: 'demo-user-123',
      jobId: 'job-101',
      jobTitle: 'Backend Developer',
      companyName: 'Acme Cloud',
      recruiterId: 'rec-1',
      recruiterName: 'Amit Sharma',
      recruiterEmail: 'amit@acme.com',
      recruiterRole: 'Technical Recruiter',
      subject: 'Outreach Subject',
      body: 'Hello Amit, ...',
      templateType: 'FIRST_CONTACT' as OutreachTemplateType,
      isApproved: false, // NOT APPROVED
      aiReasoning: 'Initial outreach',
      confidence: 0.94,
      createdAt: new Date().toISOString()
    });

    const dispatchRes = await request(app)
      .post('/api/email/dispatch')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ messageId });

    expect(dispatchRes.status).toBe(400);
    expect(dispatchRes.body.error).toContain('Approval Required');
  });

  it('8. Tokens are NEVER returned in API responses', async () => {
    const connectedAccount = await emailOAuthService.handleOAuthCallback(userId, 'gmail', 'mock-auth-code-security-test', oauthStateService.generateState(userId, 'gmail'));

    const accountsRes = await request(app)
      .get('/api/email/accounts')
      .set('Authorization', `Bearer ${authToken}`);

    expect(accountsRes.status).toBe(200);
    expect(accountsRes.body.length).toBeGreaterThan(0);
    const acc = accountsRes.body.find((a: any) => a.id === connectedAccount.id);
    expect(acc).toBeDefined();
    expect(acc.encryptedAccessToken).toBeUndefined();
    expect(acc.encryptedRefreshToken).toBeUndefined();
    expect(acc.accessToken).toBeUndefined();
    expect(acc.refreshToken).toBeUndefined();
  });

  it('9. Duplicate dispatch protection: Rejects second dispatch attempt for already sent email', async () => {
    const messageId = `msg-approved-dupe-${Date.now()}`;
    queuedEmailsMap.set(messageId, {
      id: messageId,
      userId: 'demo-user-123',
      jobId: 'job-101',
      jobTitle: 'Backend Developer',
      companyName: 'Acme Cloud',
      recruiterId: 'rec-1',
      recruiterName: 'Amit Sharma',
      recruiterEmail: 'amit@acme.com',
      recruiterRole: 'Technical Recruiter',
      subject: 'Outreach Subject',
      body: 'Hello Amit, ...',
      templateType: 'FIRST_CONTACT' as OutreachTemplateType,
      isApproved: true,
      sentAt: new Date().toISOString(), // ALREADY SENT
      aiReasoning: 'Initial outreach',
      confidence: 0.94,
      createdAt: new Date().toISOString()
    });

    const dispatchRes = await request(app)
      .post('/api/email/dispatch')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ messageId });

    expect(dispatchRes.status).toBe(400);
    expect(dispatchRes.body.error).toContain('Duplicate Protection');
  });

  it('10. Account Disconnection API: Revokes credentials and disconnects account cleanly', async () => {
    const listRes = await request(app)
      .get('/api/email/accounts')
      .set('Authorization', `Bearer ${authToken}`);

    const targetAccount = listRes.body[0];
    expect(targetAccount).toBeDefined();

    const disconnectRes = await request(app)
      .delete(`/api/email/accounts/${targetAccount.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(disconnectRes.status).toBe(200);
    expect(disconnectRes.body.success).toBe(true);

    const accountsRes = await request(app)
      .get('/api/email/accounts')
      .set('Authorization', `Bearer ${authToken}`);

    const found = accountsRes.body.find((a: any) => a.id === targetAccount.id);
    expect(found).toBeUndefined();
  });
});
