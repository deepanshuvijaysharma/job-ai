import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';
import { queuedEmailsMap } from '../controllers/outreachController';
import { ApplicationStatus } from '@jobhunter/types';

describe('JobHunter AI Step 1: Dynamic Pure Database Analytics Test Suite', () => {
  let authToken: string;

  beforeAll(async () => {
    jest.setTimeout(20000);
    memoryStore.clearAllData();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deepanshu@example.com', password: 'password123' });
    authToken = loginRes.body.token;
  });

  beforeEach(() => {
    memoryStore.clearAllData();
    queuedEmailsMap.clear();
  });

  it('1. Empty database: All metrics = 0 and status is INSUFFICIENT_DATA', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.funnel.applications).toBe(0);
    expect(res.body.funnel.recruiterOutreachSent).toBe(0);
    expect(res.body.funnel.recruiterConversations).toBe(0);
    expect(res.body.funnel.interviews).toBe(0);
    expect(res.body.funnel.offers).toBe(0);

    expect(res.body.metrics.appToResponseRate).toBe(0);
    expect(res.body.metrics.appToInterviewRate).toBe(0);
    expect(res.body.metrics.outreachToResponseRate).toBe(0);
    expect(res.body.metrics.offerRate).toBe(0);

    // Strategy insights return INSUFFICIENT_DATA
    const stratRes = await request(app)
      .get('/api/analytics/strategy')
      .set('Authorization', `Bearer ${authToken}`);
    expect(stratRes.body[0].confidence).toBe('INSUFFICIENT_DATA');

    // Weekly report returns insufficient_data
    const weeklyRes = await request(app)
      .get('/api/analytics/weekly')
      .set('Authorization', `Bearer ${authToken}`);
    expect(weeklyRes.body.topPerformers.bestRole).toBe('insufficient_data');
    expect(weeklyRes.body.topPerformers.bestSource).toBe('insufficient_data');
  });

  it('2. One application, no response: Application Response Rate = 0%', async () => {
    memoryStore.jobs.set('job-p1', {
      id: 'job-p1',
      title: 'Backend Developer',
      companyId: 'c1',
      companyName: 'TechCorp',
      source: 'Greenhouse Public Board',
      canonicalUrl: 'https://techcorp.com/careers/job-p1',
      applicationUrl: 'https://techcorp.com/apply/job-p1',
      location: 'Remote',
      remoteType: 'REMOTE' as any,
      description: 'Node.js Backend Dev',
      requiredSkills: ['Node.js'],
      preferredSkills: [],
      postedAt: new Date().toISOString()
    });

    memoryStore.applications.set('demo-user-123_job-p1', {
      id: 'app-p1',
      userId: 'demo-user-123',
      jobId: 'job-p1',
      status: ApplicationStatus.APPLIED,
      qualityScore: 90,
      createdAt: new Date().toISOString()
    });

    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.body.funnel.applications).toBe(1);
    expect(res.body.funnel.recruiterConversations).toBe(0);
    expect(res.body.metrics.appToResponseRate).toBe(0);
  });

  it('3. One recruiter contact, no response: Recruiter Response Rate = 0%', async () => {
    queuedEmailsMap.set('msg-p1', {
      id: 'msg-p1',
      userId: 'demo-user-123',
      jobId: 'job-p1',
      jobTitle: 'Backend Developer',
      companyName: 'TechCorp',
      recruiterId: 'rec-1',
      recruiterName: 'John Lead',
      recruiterEmail: 'john@techcorp.com',
      recruiterRole: 'Technical Recruiter',
      subject: 'Outreach',
      body: 'Hello',
      templateType: 'INITIAL_OUTREACH',
      isApproved: true, // Outbound sent!
      sentAt: new Date().toISOString(),
      aiReasoning: 'Test',
      confidence: 0.9,
      createdAt: new Date().toISOString()
    });

    memoryStore.applications.set('demo-user-123_job-p1', {
      id: 'app-p1',
      userId: 'demo-user-123',
      jobId: 'job-p1',
      status: ApplicationStatus.APPLIED,
      qualityScore: 90,
      createdAt: new Date().toISOString()
    });

    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.body.funnel.recruiterOutreachSent).toBe(1);
    expect(res.body.funnel.recruiterConversations).toBe(0);
    expect(res.body.metrics.outreachToResponseRate).toBe(0);
  });

  it('4. Recruiter replies: Response count increases exactly by 1', async () => {
    queuedEmailsMap.set('msg-p1', {
      id: 'msg-p1',
      userId: 'demo-user-123',
      jobId: 'job-p1',
      jobTitle: 'Backend Developer',
      companyName: 'TechCorp',
      recruiterId: 'rec-1',
      recruiterName: 'John Lead',
      recruiterEmail: 'john@techcorp.com',
      recruiterRole: 'Technical Recruiter',
      subject: 'Outreach',
      body: 'Hello',
      templateType: 'INITIAL_OUTREACH',
      isApproved: true,
      sentAt: new Date().toISOString(),
      aiReasoning: 'Test',
      confidence: 0.9,
      createdAt: new Date().toISOString()
    });

    memoryStore.applications.set('demo-user-123_job-p1', {
      id: 'app-p1',
      userId: 'demo-user-123',
      jobId: 'job-p1',
      status: ApplicationStatus.RECRUITER_RESPONDED, // Recruiter replied!
      qualityScore: 90,
      createdAt: new Date().toISOString()
    });

    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.body.funnel.recruiterConversations).toBe(1);
    expect(res.body.metrics.outreachToResponseRate).toBe(100);
  });

  it('5. Interview scheduled: Interview count increases exactly by 1', async () => {
    memoryStore.applications.set('demo-user-123_job-p1', {
      id: 'app-p1',
      userId: 'demo-user-123',
      jobId: 'job-p1',
      status: ApplicationStatus.INTERVIEW_SCHEDULED,
      qualityScore: 90,
      createdAt: new Date().toISOString()
    });

    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.body.funnel.interviews).toBe(1);
    expect(res.body.metrics.appToInterviewRate).toBe(100);
  });

  it('6. Role, Source, and Resume performance breakdowns: Derived strictly from actual applications', async () => {
    memoryStore.jobs.set('job-role-1', {
      id: 'job-role-1',
      title: 'Senior Node.js Backend Engineer',
      companyId: 'c1',
      companyName: 'CloudCorp',
      source: 'Greenhouse Public Board',
      canonicalUrl: 'https://cloudcorp.com/careers/job-role-1',
      applicationUrl: 'https://cloudcorp.com/apply/job-role-1',
      location: 'Remote',
      remoteType: 'REMOTE' as any,
      description: 'Backend Engineer',
      requiredSkills: ['Node.js'],
      preferredSkills: [],
      postedAt: new Date().toISOString()
    });

    memoryStore.matches.set('demo-user-123_job-role-1', {
      overallScore: 95,
      priority: 'APPLY_NOW' as any,
      breakdown: {} as any,
      whyApply: [],
      whatHoldsBack: [],
      recommendedResumeId: 'res-backend',
      recommendedResumeTitle: 'Backend Node.js & Microservices Resume'
    });

    memoryStore.applications.set('demo-user-123_job-role-1', {
      id: 'app-role-1',
      userId: 'demo-user-123',
      jobId: 'job-role-1',
      status: ApplicationStatus.INTERVIEW_SCHEDULED,
      qualityScore: 95,
      createdAt: new Date().toISOString()
    });

    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.body.yieldByRole[0].category).toBe('Backend Developer');
    expect(res.body.yieldByRole[0].applications).toBe(1);
    expect(res.body.yieldByRole[0].interviews).toBe(1);
    expect(res.body.yieldByRole[0].confidence).toBe('INSUFFICIENT_DATA'); // 1 application < 5 threshold

    expect(res.body.yieldBySource[0].category).toBe('Greenhouse Public Board');
    expect(res.body.yieldBySource[0].applications).toBe(1);

    expect(res.body.yieldByResume[0].category).toBe('Backend Node.js & Microservices Resume');
    expect(res.body.yieldByResume[0].applications).toBe(1);
  });

  it('7. Weekly report contains zero fabricated values and respects sample size protection', async () => {
    const weeklyRes = await request(app)
      .get('/api/analytics/weekly')
      .set('Authorization', `Bearer ${authToken}`);

    expect(weeklyRes.status).toBe(200);
    expect(weeklyRes.body.topPerformers.bestRole).toBe('insufficient_data');
    expect(weeklyRes.body.topPerformers.bestSource).toBe('insufficient_data');
    expect(weeklyRes.body.topPerformers.bestResume).toBe('insufficient_data');
    expect(weeklyRes.body.topPerformers.bestCompanyType).toBe('insufficient_data');
    expect(weeklyRes.body.recommendationsNextWeek[0]).toContain('minimum 5 applications required');
  });
});
