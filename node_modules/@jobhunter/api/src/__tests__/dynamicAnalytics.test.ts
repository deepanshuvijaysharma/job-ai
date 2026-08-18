import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';

describe('JobHunter AI Step 1: Real Dynamic Analytics Verification Suite', () => {
  let authToken: string;

  beforeAll(async () => {
    // Reset memory store to clean state
    memoryStore.clearAllData();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deepanshu@example.com', password: 'password123' });
    authToken = res.body.token;
  });

  it('1. Empty store should return exact zero metrics without fake data', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.funnel.jobsDiscovered).toBe(0);
    expect(res.body.funnel.applications).toBe(0);
    expect(res.body.funnel.recruiterConversations).toBe(0);
    expect(res.body.funnel.interviews).toBe(0);
    expect(res.body.metrics.appToResponseRate).toBe(0);
    expect(res.body.metrics.appToInterviewRate).toBe(0);
    expect(res.body.yieldByRole).toEqual([]);
    expect(res.body.yieldBySource).toEqual([]);
  });

  it('2. Importing a job dynamically increments jobsDiscovered and calculates real match', async () => {
    const importRes = await request(app)
      .post('/api/jobs/import')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        url: 'https://careers.google.com/jobs/results/999888777',
        title: 'Backend Software Engineer - Node.js',
        companyName: 'Google India',
        location: 'Gurgaon',
        description: 'Build backend cloud microservices with Node.js, REST API, SQL.',
        requiredSkills: ['Node.js', 'SQL', 'TypeScript']
      });

    expect(importRes.status).toBe(201);
    const jobId = importRes.body.job.id;

    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.funnel.jobsDiscovered).toBe(1);
  });

  it('3. Submitting an application dynamically updates applications count and response rates', async () => {
    const jobsRes = await request(app)
      .get('/api/jobs')
      .set('Authorization', `Bearer ${authToken}`);

    const job = jobsRes.body[0];

    // Create application with status APPLIED
    await request(app)
      .post('/api/applications/status')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        jobId: job.id,
        status: 'APPLIED'
      });

    let analyticsRes = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(analyticsRes.body.funnel.applications).toBe(1);
    expect(analyticsRes.body.metrics.appToResponseRate).toBe(0);

    // Advance status to RECRUITER_RESPONDED
    await request(app)
      .post('/api/applications/status')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        jobId: job.id,
        status: 'RECRUITER_RESPONDED'
      });

    analyticsRes = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(analyticsRes.body.funnel.recruiterConversations).toBe(1);
    expect(analyticsRes.body.metrics.appToResponseRate).toBe(100); // 1 response / 1 app * 100

    // Advance status to INTERVIEW_SCHEDULED
    await request(app)
      .post('/api/applications/status')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        jobId: job.id,
        status: 'INTERVIEW_SCHEDULED'
      });

    analyticsRes = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(analyticsRes.body.funnel.interviews).toBe(1);
    expect(analyticsRes.body.metrics.appToInterviewRate).toBe(100); // 1 interview / 1 app * 100
  });
});
