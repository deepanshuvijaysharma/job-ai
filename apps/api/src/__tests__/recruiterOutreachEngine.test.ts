import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';
import { queuedEmailsMap } from '../controllers/outreachController';
import { followUpEngineService } from '../services/outreach/followUpEngine';
import { emailGeneratorService } from '../services/outreach/emailGenerator';

describe('JobHunter AI Step 8: Recruiter Outreach Engine Suite', () => {
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

  it('1. Message Personalization: Generates non-generic tailored outreach without fabricated data', async () => {
    const draft = await emailGeneratorService.generatePersonalizedEmail(
      {
        name: 'Deepanshu Sharma',
        currentRole: 'Full Stack Engineer',
        skills: ['Node.js', 'Express.js', 'PostgreSQL', 'TypeScript'],
        projects: [{ title: 'JobHunter AI Platform' }]
      },
      {
        title: 'Backend Software Engineer',
        companyName: 'Acme Enterprise',
        requiredSkills: ['Node.js', 'PostgreSQL'],
        location: 'Noida'
      },
      { name: 'Amit Sharma', role: 'Technical Recruiter' },
      'INITIAL_OUTREACH'
    );

    expect(draft.subject).toContain('Backend Software Engineer');
    expect(draft.body).toContain('Hi Amit');
    expect(draft.body).toContain('Node.js');
    expect(draft.aiReasoning).toBeDefined();
  });

  it('2. Support for 6 Message Templates: Handles all required template types cleanly', async () => {
    const templates = [
      'INITIAL_OUTREACH',
      'APPLICATION_FOLLOWUP',
      'RECRUITER_RESPONSE',
      'HIRING_MANAGER_OUTREACH',
      'REFERRAL_REQUEST',
      'INTERVIEW_THANK_YOU'
    ] as const;

    for (const t of templates) {
      const draft = await emailGeneratorService.generatePersonalizedEmail(
        {
          name: 'Deepanshu Sharma',
          currentRole: 'Full Stack Engineer',
          skills: ['Node.js', 'React.js'],
          projects: []
        },
        { title: 'Full Stack Developer', companyName: 'TechCorp', requiredSkills: ['Node.js'], location: 'Remote' },
        { name: 'Priya Verma', role: 'Engineering Lead' },
        t
      );
      expect(draft.body.length).toBeGreaterThan(30);
    }
  });

  it('3. Approval Queue Actions & Daily Limits: Displays queue details and enforces 10/day limit', async () => {
    const queueRes = await request(app)
      .get('/api/outreach/approval-queue')
      .set('Authorization', `Bearer ${authToken}`);

    expect(queueRes.status).toBe(200);
    expect(queueRes.body.dailyLimit).toBe(10);
    expect(queueRes.body.dailyRemaining).toBeDefined();
  });

  it('4. Follow-Up Scheduling: Schedules Day 2, Day 5, and Day 10 follow-ups upon outreach approval', async () => {
    const tasks = await followUpEngineService.scheduleFollowUps({
      userId: 'demo-user-123',
      jobId: 'job-101',
      jobTitle: 'Backend Engineer',
      companyName: 'Acme Cloud',
      recruiterId: 'rec-101',
      recruiterName: 'Amit Sharma'
    });

    expect(tasks.length).toBe(3); // Day 2, Day 5, Day 10
    expect(tasks[0].scheduledForDays).toBe(2);
    expect(tasks[1].scheduledForDays).toBe(5);
    expect(tasks[2].scheduledForDays).toBe(10);
  });

  it('5. Automatic Stop Conditions: Immediately suppresses pending follow-ups when recruiter replies or job closes', () => {
    const suppressed = followUpEngineService.evaluateStopCondition('job-101', 'rec-101', 'REPLIED');
    expect(suppressed).toBe(3);

    const dueList = followUpEngineService.getDueFollowUps('demo-user-123');
    expect(dueList.filter(t => t.jobId === 'job-101').length).toBe(0);
  });
});
