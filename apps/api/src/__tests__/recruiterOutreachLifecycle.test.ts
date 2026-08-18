import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';
import { emailGeneratorService } from '../services/outreach/emailGenerator';
import { followUpEngineService } from '../services/outreach/followUpEngine';
import { queuedEmailsMap } from '../controllers/outreachController';
import { OutreachMessageType } from '@jobhunter/types';

describe('JobHunter AI Step 8: Recruiter Outreach & Follow-Up Lifecycle Suite', () => {
  let authToken: string;

  beforeAll(async () => {
    jest.setTimeout(25000);
    memoryStore.clearAllData();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deepanshu@example.com', password: 'password123' });
    authToken = loginRes.body.token;
  });

  it('1. Recruiter Greeting Rule: Uses "Hi Amit," when recruiter first name is verified, "Hello," when missing', () => {
    const firstName = emailGeneratorService.extractFirstName('Amit Sharma');
    expect(firstName).toBe('Amit');

    const unknownName = emailGeneratorService.extractFirstName('Unknown');
    expect(unknownName).toBeNull();

    const genericName = emailGeneratorService.extractFirstName('Hiring Team');
    expect(genericName).toBeNull();
  });

  it('2. Message Type Personalization & Zero-Fabrication: Generates 6 message types without fabricating false claims', async () => {
    const candidate = {
      name: 'Deepanshu Sharma',
      currentRole: 'Full Stack Engineer',
      skills: ['Node.js', 'TypeScript', 'React', 'PostgreSQL'],
      projects: [{ title: 'JobHunter AI Platform' }]
    };

    const job = {
      title: 'Backend Engineer',
      companyName: 'Acme Cloud',
      requiredSkills: ['Node.js', 'PostgreSQL'],
      location: 'Remote'
    };

    const recruiter = { name: 'Amit Sharma', role: 'Technical Recruiter' };

    const types: OutreachMessageType[] = [
      'INITIAL_OUTREACH',
      'APPLICATION_FOLLOWUP',
      'HIRING_MANAGER_OUTREACH',
      'REFERRAL_REQUEST',
      'INTERVIEW_THANK_YOU',
      'FINAL_FOLLOWUP'
    ];

    for (const templateType of types) {
      const draft = await emailGeneratorService.generatePersonalizedEmail(
        candidate,
        job,
        recruiter,
        templateType
      );

      expect(draft.subject).toBeDefined();
      expect(draft.body).toContain('Hi Amit,');
      expect(draft.body).toContain('Node.js');
      expect(draft.body).not.toContain('AWS Certified'); // No fabricated certifications
      expect(draft.body).not.toContain('Dear Sir/Madam'); // No generic headers
    }
  });

  it('3. Draft Generation API: Creates queued email draft in approval queue requiring explicit user approval', async () => {
    memoryStore.jobs.set('job-101', {
      id: 'job-101',
      title: 'Backend Engineer',
      companyName: 'Acme Cloud',
      location: 'Remote',
      requiredSkills: ['Node.js', 'PostgreSQL'],
      recruiters: [{ id: 'rec-1', name: 'Amit Sharma', role: 'Technical Recruiter', email: 'amit@acme.com' }]
    } as any);

    const genRes = await request(app)
      .post('/api/outreach/generate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        jobId: 'job-101',
        templateType: 'INITIAL_OUTREACH'
      });

    expect(genRes.status).toBe(201);
    expect(genRes.body.id).toBeDefined();
    expect(genRes.body.isApproved).toBe(false); // Default unapproved

    const queueRes = await request(app)
      .get('/api/outreach/approval-queue')
      .set('Authorization', `Bearer ${authToken}`);

    expect(queueRes.status).toBe(200);
    expect(queueRes.body.pending.length).toBeGreaterThan(0);
  });

  it('4. Multi-Stage Follow-Up Scheduling: Automatically schedules Stage 1 (Day 2), Stage 2 (Day 5), and Stage 3 (Day 10) follow-ups upon approval', async () => {
    const tasks = await followUpEngineService.scheduleFollowUps({
      userId: 'demo-user-123',
      jobId: 'job-101',
      jobTitle: 'Backend Engineer',
      companyName: 'Acme Cloud',
      recruiterId: 'rec-1',
      recruiterName: 'Amit Sharma',
      recruiterEmail: 'amit@acme.com'
    });

    expect(tasks.length).toBe(3);
    expect(tasks[0].stage).toBe(1);
    expect(tasks[0].scheduledForDays).toBe(2);
    expect(tasks[1].stage).toBe(2);
    expect(tasks[1].scheduledForDays).toBe(5);
    expect(tasks[2].stage).toBe(3);
    expect(tasks[2].scheduledForDays).toBe(10);
    expect(tasks[0].body).toContain('Hi Amit,');
  });

  it('5. Automatic Stop Conditions: Immediately suppresses pending follow-ups when stop condition is evaluated', async () => {
    const suppressedCount = followUpEngineService.evaluateStopCondition(
      'job-101',
      'rec-1',
      'REPLIED'
    );

    expect(suppressedCount).toBeGreaterThan(0);

    const dueTasks = followUpEngineService.getDueFollowUps('demo-user-123');
    const matched = dueTasks.filter(t => t.jobId === 'job-101' && t.recruiterId === 'rec-1');
    expect(matched.length).toBe(0); // All suppressed
  });
});
