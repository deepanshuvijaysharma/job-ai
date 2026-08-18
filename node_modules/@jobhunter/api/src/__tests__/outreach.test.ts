import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';
import { seedDemoOutreachEmails } from '../controllers/outreachController';

describe('JobHunter AI Recruiter Outreach & Approval Queue Suite', () => {
  let authToken: string;

  beforeAll(async () => {
    jest.setTimeout(20000);
    memoryStore.seedDemoDataForTesting();
    seedDemoOutreachEmails();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deepanshu@example.com', password: 'password123' });
    authToken = res.body.token;
  });

  it('1. GET /api/outreach/approval-queue should return pending email drafts', async () => {
    const res = await request(app)
      .get('/api/outreach/approval-queue')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pending.length).toBeGreaterThan(0);
    expect(res.body.dailyLimit).toBe(10);
    expect(res.body.pending[0].subject).toContain('Application');
  });

  it('2. POST /api/outreach/generate should draft a personalized recruiter email', async () => {
    const res = await request(app)
      .post('/api/outreach/generate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        jobId: 'job-101',
        templateType: 'FIRST_CONTACT'
      });

    expect(res.status).toBe(201);
    expect(res.body.recruiterName).toBe('Amit Sharma');
    expect(res.body.body).toContain('Node.js');
    expect(res.body.isApproved).toBe(false);
  });

  it('3. POST /api/outreach/edit should update draft email body', async () => {
    const res = await request(app)
      .post('/api/outreach/edit')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        messageId: 'msg-101',
        body: 'Hi Amit,\n\nEdited custom body for outreach test.\n\nThanks,\nDeepanshu'
      });

    expect(res.status).toBe(200);
    expect(res.body.body).toContain('Edited custom body');
  });

  it('4. POST /api/outreach/approve should approve & send message, updating pipeline status', async () => {
    const res = await request(app)
      .post('/api/outreach/approve')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        messageIds: ['msg-101']
      });

    expect(res.status).toBe(200);
    expect(res.body.approved.length).toBe(1);
    expect(res.body.approved[0].isApproved).toBe(true);

    // Verify application status updated to RECRUITER_CONTACTED
    const appRes = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${authToken}`);

    const updatedApp = appRes.body.find((a: any) => a.jobId === 'job-101');
    expect(updatedApp.status).toBe('RECRUITER_CONTACTED');
  });

  it('5. GET /api/outreach/followups should return scheduled follow-up reminders', async () => {
    const res = await request(app)
      .get('/api/outreach/followups')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].jobTitle).toBeDefined();
  });
});
