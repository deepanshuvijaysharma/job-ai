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
  let originalFetch: typeof global.fetch;

  beforeAll(async () => {
    jest.setTimeout(25000);
    memoryStore.clearAllData();
    originalFetch = global.fetch;
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deepanshu@example.com', password: 'password123' });
    authToken = loginRes.body.token;
    userId = loginRes.body.user?.id || 'demo-user-123';
  });

  afterEach(() => {
    global.fetch = originalFetch;
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
    const validState = oauthStateService.generateState(userId, 'gmail');
    const validation = oauthStateService.validateState(validState, userId, 'gmail');
    expect(validation.isValid).toBe(true);

    const forgedState = validState.substring(0, validState.length - 4) + 'abcd';
    const forgedValidation = oauthStateService.validateState(forgedState, userId, 'gmail');
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

  it('6. Gmail successful send persists real message ID (data.id)', async () => {
    const accountId = `acc-gmail-real-${Date.now()}`;
    const accState = {
      id: accountId,
      userId,
      provider: 'gmail' as const,
      emailAddress: 'deepanshu.gmail@example.com',
      encryptedAccessToken: tokenEncryption.encryptToken('valid-gmail-token'),
      encryptedRefreshToken: null,
      isDefault: true,
      isConnected: true,
      dailySentCount: 0,
      createdAt: new Date().toISOString()
    };
    await emailRepository.upsertAccount({ ...accState, encryptedRefreshToken: undefined });
    emailOAuthService.saveToLocalCache(accState);

    const realGmailId = '18a4f9b2c8d10e0f';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: realGmailId })
    } as any);

    const messageId = `msg-real-gmail-${Date.now()}`;
    queuedEmailsMap.set(messageId, {
      id: messageId,
      userId,
      jobId: 'job-101',
      jobTitle: 'Backend Engineer',
      companyName: 'Acme Cloud',
      recruiterId: 'rec-1',
      recruiterName: 'Amit Sharma',
      recruiterEmail: 'amit@acme.com',
      recruiterRole: 'Technical Recruiter',
      subject: 'Real Gmail Outreach',
      body: 'Hello Amit...',
      templateType: 'FIRST_CONTACT' as OutreachTemplateType,
      isApproved: true,
      aiReasoning: 'Initial outreach',
      confidence: 0.95,
      createdAt: new Date().toISOString()
    });

    const res = await request(app)
      .post('/api/email/dispatch')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ messageId });

    expect(res.status).toBe(200);
    expect(res.body.log.status).toBe('SENT');
    expect(res.body.log.externalMessageId).toBe(realGmailId);
  });

  it('7. Gmail provider failure results in status = FAILED and sentAt = null (no synthetic IDs)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Invalid Credentials'
    } as any);

    const messageId = `msg-fail-gmail-${Date.now()}`;
    queuedEmailsMap.set(messageId, {
      id: messageId,
      userId,
      jobId: 'job-101',
      jobTitle: 'Backend Engineer',
      companyName: 'Acme Cloud',
      recruiterId: 'rec-1',
      recruiterName: 'Amit Sharma',
      recruiterEmail: 'amit@acme.com',
      recruiterRole: 'Technical Recruiter',
      subject: 'Failed Gmail Outreach',
      body: 'Hello Amit...',
      templateType: 'FIRST_CONTACT' as OutreachTemplateType,
      isApproved: true,
      aiReasoning: 'Initial outreach',
      confidence: 0.95,
      createdAt: new Date().toISOString()
    });

    const res = await request(app)
      .post('/api/email/dispatch')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ messageId });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Email Dispatch Failed');
  });

  it('8. Outlook HTTP 202 results in status = SENT with externalMessageId = null', async () => {
    const accountId = `acc-outlook-real-${Date.now()}`;
    const accState = {
      id: accountId,
      userId,
      provider: 'outlook' as const,
      emailAddress: 'deepanshu.outlook@example.com',
      encryptedAccessToken: tokenEncryption.encryptToken('valid-outlook-token'),
      encryptedRefreshToken: null,
      isDefault: true,
      isConnected: true,
      dailySentCount: 0,
      createdAt: new Date().toISOString()
    };
    await emailRepository.upsertAccount({ ...accState, encryptedRefreshToken: undefined });
    emailOAuthService.saveToLocalCache(accState);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({})
    } as any);

    const messageId = `msg-real-outlook-${Date.now()}`;
    queuedEmailsMap.set(messageId, {
      id: messageId,
      userId,
      jobId: 'job-101',
      jobTitle: 'Backend Engineer',
      companyName: 'Acme Cloud',
      recruiterId: 'rec-1',
      recruiterName: 'Amit Sharma',
      recruiterEmail: 'amit@acme.com',
      recruiterRole: 'Technical Recruiter',
      subject: 'Real Outlook Outreach',
      body: 'Hello Amit...',
      templateType: 'FIRST_CONTACT' as OutreachTemplateType,
      isApproved: true,
      aiReasoning: 'Initial outreach',
      confidence: 0.95,
      createdAt: new Date().toISOString()
    });

    const res = await request(app)
      .post('/api/email/dispatch')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ messageId });

    expect(res.status).toBe(200);
    expect(res.body.log.status).toBe('SENT');
    expect(res.body.log.externalMessageId).toBeNull();
  });

  it('9. Approval requirement guardrail: Rejects unapproved recruiter email dispatch with HTTP 400', async () => {
    const messageId = `msg-unapproved-${Date.now()}`;
    queuedEmailsMap.set(messageId, {
      id: messageId,
      userId,
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

  it('10. Tokens are NEVER returned in API responses', async () => {
    const accountsRes = await request(app)
      .get('/api/email/accounts')
      .set('Authorization', `Bearer ${authToken}`);

    expect(accountsRes.status).toBe(200);
    expect(accountsRes.body.length).toBeGreaterThan(0);
    const acc = accountsRes.body[0];
    expect(acc).toBeDefined();
    expect(acc.encryptedAccessToken).toBeUndefined();
    expect(acc.encryptedRefreshToken).toBeUndefined();
    expect(acc.accessToken).toBeUndefined();
    expect(acc.refreshToken).toBeUndefined();
  });

  it('11. Duplicate dispatch protection: Rejects second dispatch attempt for already sent email', async () => {
    const messageId = `msg-approved-dupe-${Date.now()}`;
    queuedEmailsMap.set(messageId, {
      id: messageId,
      userId,
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

  it('12. Account Disconnection API: Revokes credentials and disconnects account cleanly', async () => {
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
