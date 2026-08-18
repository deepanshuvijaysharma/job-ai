import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';
import { tokenEncryption } from '../services/email/tokenEncryption';
import { emailOAuthService } from '../services/email/emailOAuthService';
import { queuedEmailsMap } from '../controllers/outreachController';
import { OutreachTemplateType } from '../services/outreach/emailGenerator';

describe('JobHunter AI Step 7: Gmail & Outlook Integration Suite', () => {
  let authToken: string;

  beforeAll(async () => {
    jest.setTimeout(20000);
    memoryStore.clearAllData();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deepanshu@example.com', password: 'password123' });
    authToken = loginRes.body.token;
  });

  it('1. Token Security & AES Encryption: Correctly encrypts and decrypts OAuth tokens', () => {
    const rawToken = 'ya29.a0-secret-access-token-12345';
    const encrypted = tokenEncryption.encryptToken(rawToken);

    expect(encrypted).not.toBe(rawToken);
    expect(encrypted.includes(':')).toBe(true);

    const decrypted = tokenEncryption.decryptToken(encrypted);
    expect(decrypted).toBe(rawToken);
  });

  it('2. OAuth Consent URL Generation: Generates valid Gmail & Outlook auth URLs with minimal required scopes', async () => {
    const gmailRes = await request(app)
      .get('/api/email/oauth/gmail/url')
      .set('Authorization', `Bearer ${authToken}`);

    expect(gmailRes.status).toBe(200);
    expect(gmailRes.body.url).toContain('accounts.google.com');
    expect(gmailRes.body.url).toContain('gmail.send');

    const outlookRes = await request(app)
      .get('/api/email/oauth/outlook/url')
      .set('Authorization', `Bearer ${authToken}`);

    expect(outlookRes.status).toBe(200);
    expect(outlookRes.body.url).toContain('login.microsoftonline.com');
    expect(outlookRes.body.url).toContain('Mail.Send');
  });

  it('3. OAuth Callback & Connection Flow: Processes code, encrypts tokens, and connects account', async () => {
    const callbackRes = await request(app)
      .get('/api/email/oauth/gmail/callback?code=mock-google-auth-code-123')
      .set('Authorization', `Bearer ${authToken}`);

    expect(callbackRes.status).toBe(200);
    expect(callbackRes.body.account.isConnected).toBe(true);
    expect(callbackRes.body.account.provider).toBe('gmail');

    // Verify token security: Tokens are NOT exposed in accounts endpoint
    const accountsRes = await request(app)
      .get('/api/email/accounts')
      .set('Authorization', `Bearer ${authToken}`);

    expect(accountsRes.status).toBe(200);
    expect(accountsRes.body.length).toBeGreaterThan(0);
    expect(accountsRes.body[0].encryptedAccessToken).toBeUndefined();
    expect(accountsRes.body[0].encryptedRefreshToken).toBeUndefined();
  });

  it('4. Safe Test Email Mechanism: Users can send a test email to verify connection', async () => {
    const testRes = await request(app)
      .post('/api/email/test')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        recipientEmail: 'deepanshu.test@example.com'
      });

    expect(testRes.status).toBe(200);
    expect(testRes.body.message).toContain('successfully sent');
  });

  it('5. Approval Requirement Guardrail: Rejects unapproved recruiter email dispatch', async () => {
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
      templateType: 'INITIAL_OUTREACH' as OutreachTemplateType,
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

  it('6. Approved Email Dispatch & Duplicate Prevention: Dispatches approved email once only', async () => {
    const messageId = `msg-approved-${Date.now()}`;
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
      templateType: 'INITIAL_OUTREACH' as OutreachTemplateType,
      isApproved: true, // EXPLICITLY APPROVED
      aiReasoning: 'Initial outreach',
      confidence: 0.94,
      createdAt: new Date().toISOString()
    });

    const firstDispatch = await request(app)
      .post('/api/email/dispatch')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ messageId });

    expect(firstDispatch.status).toBe(200);
    expect(firstDispatch.body.log.status).toBe('SENT');

    // Duplicate sending attempt must be rejected cleanly
    const secondDispatch = await request(app)
      .post('/api/email/dispatch')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ messageId });

    expect(secondDispatch.status).toBe(400);
    expect(secondDispatch.body.error).toContain('Duplicate Protection');
  });
});
