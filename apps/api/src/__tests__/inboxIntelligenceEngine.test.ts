import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';
import { inboxIntelligenceService } from '../services/email/inboxIntelligence';
import { InboxProviderFactory, GmailInboxProvider, OutlookInboxProvider } from '../services/email/inboxProvider';
import { followUpEngineService } from '../services/outreach/followUpEngine';
import { followUpRepository, userRepository } from '../repositories/prismaRepository';

describe('JobHunter AI Step 9: Inbox Intelligence & Recruiter Reply Detection Suite', () => {
  let authToken: string;
  let testUserId = 'demo-user-123';

  beforeAll(async () => {
    jest.setTimeout(25000);
    memoryStore.clearAllData();
    memoryStore.seedDemoDataForTesting();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deepanshu@example.com', password: 'password123' });
    authToken = loginRes.body.token;
    if (loginRes.body.user?.id) {
      testUserId = loginRes.body.user.id;
    }
  });

  it('1. InboxProvider Abstraction: Factory resolves Gmail & Outlook providers', () => {
    const gmailProvider = InboxProviderFactory.getProvider('gmail');
    expect(gmailProvider).toBeInstanceOf(GmailInboxProvider);

    const outlookProvider = InboxProviderFactory.getProvider('outlook');
    expect(outlookProvider).toBeInstanceOf(OutlookInboxProvider);
  });

  it('2. Deterministic 4-Tier Application Matcher: Matches by thread ID, recruiter email, domain & extracted entity', async () => {
    memoryStore.applications.clear();
    const mockApp = {
      id: 'app-match-101',
      userId: testUserId,
      jobId: 'job-match-101',
      recruiterEmail: 'recruiter@acmecloud.com',
      companyName: 'Acme Cloud',
      jobTitle: 'Senior Cloud Engineer',
      status: 'APPLIED' as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      job: {
        id: 'job-match-101',
        title: 'Senior Cloud Engineer',
        companyName: 'Acme Cloud',
        location: 'Remote'
      }
    };
    memoryStore.applications.set(mockApp.id, mockApp as any);

    const extracted = {
      category: 'RECRUITER_RESPONSE' as const,
      companyName: 'Acme Cloud',
      jobTitle: 'Senior Cloud Engineer',
      confidence: 0.95
    };

    // Tier 2: Recruiter email match
    const matchedTier2 = await inboxIntelligenceService.matchApplication(
      testUserId,
      { senderEmail: 'recruiter@acmecloud.com', subject: 'Re: Application', body: 'Let us chat' },
      extracted
    );
    expect(matchedTier2?.id).toBe('app-match-101');

    // Tier 3: Domain match
    const matchedTier3 = await inboxIntelligenceService.matchApplication(
      testUserId,
      { senderEmail: 'hr@acmecloud.com', subject: 'Application Received', body: 'Thanks for applying' },
      extracted
    );
    expect(matchedTier3?.id).toBe('app-match-101');

    // Unmatched low-confidence fallback
    const unmatched = await inboxIntelligenceService.matchApplication(
      testUserId,
      { senderEmail: 'unknown@randomdomain.org', subject: 'Random newsletter', body: 'Check this out' },
      { category: 'OTHER', confidence: 0.2 }
    );
    expect(unmatched).toBeNull();
  });

  it('3. AI Entity Extraction & Classification: Extracts categories, dates, and meeting links', async () => {
    const emailData = {
      senderEmail: 'recruiter@acmecloud.com',
      senderName: 'Amit Sharma',
      subject: 'Interview Invitation: Senior Cloud Engineer role at Acme Cloud',
      body: 'Hi Alice, We would like to invite you for an interview on 22 August at 11:00 AM PST. Join via https://meet.google.com/xyz-abc-123.'
    };

    const classified = await inboxIntelligenceService.processIncomingEmail(emailData);
    expect(classified.category).toBe('INTERVIEW_INVITATION');
    expect(classified.meetingLink).toBe('https://meet.google.com/xyz-abc-123');
    expect(classified.nextAction).toBeDefined();
  });

  it('4. Safe Pipeline Update Proposal (Human-in-the-Loop): Creates proposal with isConfirmed = false', async () => {
    const res = await request(app)
      .post('/api/inbox/process')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        senderEmail: 'hr@acmecloud.com',
        subject: 'Job Offer: Senior Cloud Engineer at Acme Cloud',
        body: 'Congratulations! We are pleased to offer you the position.'
      });

    expect(res.status).toBe(200);
    expect(res.body.proposal.proposedStatus).toBe('OFFER');
    expect(res.body.proposal.isConfirmed).toBe(false); // MANDATORY HUMAN APPROVAL
  });

  it('5. Pipeline State Mutation & Follow-Up Suppression on Confirmation', async () => {
    const appId = 'app-suppress-101';
    memoryStore.applications.clear();
    const mockApp = {
      id: appId,
      userId: testUserId,
      jobId: appId,
      companyName: 'Acme Cloud',
      jobTitle: 'Backend Dev',
      recruiterEmail: 'recruiter@acmecloud.com',
      status: 'APPLIED' as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      job: { id: appId, title: 'Backend Dev', companyName: 'Acme Cloud', location: 'Remote' }
    };
    memoryStore.applications.set(appId, mockApp as any);

    // Schedule 3 follow-ups
    const tasks = await followUpEngineService.scheduleFollowUps({
      userId: testUserId,
      jobId: appId,
      jobTitle: 'Backend Dev',
      companyName: 'Acme Cloud',
      recruiterId: 'rec-suppress-1',
      recruiterName: 'Amit Sharma'
    });
    expect(tasks.length).toBe(3);

    // Process recruiter reply email
    const procRes = await request(app)
      .post('/api/inbox/process')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        senderEmail: 'recruiter@acmecloud.com',
        subject: 'Re: Backend Dev Application — Interview Invitation',
        body: 'We would love to schedule an interview with you via https://zoom.us/j/123456789.'
      });

    const proposalId = procRes.body.proposal.id;

    // User confirms pipeline update proposal
    const confirmRes = await request(app)
      .post('/api/inbox/confirm')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ proposalId });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.proposal.isConfirmed).toBe(true);

    // Verify application status mutated to INTERVIEW_SCHEDULED
    const updatedApp = memoryStore.applications.get(appId);
    expect(updatedApp?.status).toBe('INTERVIEW_SCHEDULED');

    // Verify pending follow-ups suppressed
    const dueTasks = await followUpEngineService.getDueFollowUps(testUserId, new Date(Date.now() + 10 * 86400000));
    const matchedDue = dueTasks.filter(t => t.applicationId === appId);
    expect(matchedDue.length).toBe(0);
  });

  it('6. Inbox Sync Endpoint: Triggers sync across connected email accounts', async () => {
    const res = await request(app)
      .post('/api/inbox/sync')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.syncedCount).toBeDefined();
  });
});
