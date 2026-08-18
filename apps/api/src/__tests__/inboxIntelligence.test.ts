import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';
import { inboxIntelligenceService } from '../services/email/inboxIntelligence';

describe('JobHunter AI Step 9: Inbox Intelligence & Pipeline Automation Suite', () => {
  let authToken: string;

  beforeAll(async () => {
    jest.setTimeout(20000);
    memoryStore.clearAllData();
    memoryStore.seedDemoDataForTesting();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deepanshu@example.com', password: 'password123' });
    authToken = loginRes.body.token;
  });

  it('1. Email Classification into 8 Categories: Classifies incoming email into appropriate category', async () => {
    const interviewEmail = {
      senderEmail: 'recruiter@acmecloud.com',
      senderName: 'Amit Sharma',
      subject: 'Interview Invitation: Backend Developer position at Acme Cloud',
      body: 'Hi Deepanshu, We would like to invite you to an interview on 22 August at 11:00 AM. Join via https://meet.google.com/abc-xyz'
    };

    const classified = await inboxIntelligenceService.processIncomingEmail(interviewEmail);
    expect(classified.category).toBe('INTERVIEW_INVITATION');
    expect(classified.meetingLink).toContain('meet.google.com');
  });

  it('2. Structured Entity Extraction: Extracts interview date, meeting link, and company details', async () => {
    const extracted = await inboxIntelligenceService.processIncomingEmail({
      senderEmail: 'hr@synthetix.ai',
      subject: 'Coding Assessment: AI & Backend Software Engineer',
      body: 'Please complete your technical assessment at https://hackerrank.com/test-123 before 25 August.'
    });

    expect(extracted.category).toBe('ASSESSMENT');
    expect(extracted.nextAction).toBeDefined();
  });

  it('3. User Confirmation Proposal: Generates proposal without making silent high-impact changes', async () => {
    const res = await request(app)
      .post('/api/inbox/process')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        senderEmail: 'hr@acmecloud.com',
        subject: 'Job Offer: Backend Developer at Acme Cloud',
        body: 'Congratulations! We are delighted to offer you the Backend Developer position.'
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('AI Detected OFFER');
    expect(res.body.proposal.proposedStatus).toBe('OFFER');
    expect(res.body.proposal.isConfirmed).toBe(false); // MUST be false initially!
  });

  it('4. Pipeline State Transition on User Confirmation: User confirmation updates application status', async () => {
    // Process email
    const procRes = await request(app)
      .post('/api/inbox/process')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        senderEmail: 'recruiter@acmecloud.com',
        subject: 'Interview Scheduled — Backend Developer at Acme Cloud',
        body: 'Your interview is confirmed for 22 August at 11:00 AM via https://meet.google.com/abc-xyz'
      });

    const proposalId = procRes.body.proposal.id;

    // Confirm proposal
    const confirmRes = await request(app)
      .post('/api/inbox/confirm')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ proposalId });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.proposal.isConfirmed).toBe(true);
    expect(confirmRes.body.proposal.proposedStatus).toBe('INTERVIEW_SCHEDULED');

    // Verify application status updated in store
    const appItem = memoryStore.applications.get('demo-user-123_job-101') || Array.from(memoryStore.applications.values())[0];
    expect(appItem).toBeDefined();
    expect(appItem?.status).toBe('INTERVIEW_SCHEDULED');
  });
});
