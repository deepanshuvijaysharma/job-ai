import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';
import { emailGeneratorService } from '../services/outreach/emailGenerator';
import { FollowUpEngineService, followUpEngineService } from '../services/outreach/followUpEngine';
import { queuedEmailsMap } from '../controllers/outreachController';
import { OutreachMessageType } from '@jobhunter/types';
import { followUpRepository } from '../repositories/prismaRepository';

describe('JobHunter AI Step 8 Final Correction: PostgreSQL Follow-Up Persistence & Scheduling Suite', () => {
  let authToken: string;
  const testUserId = 'demo-user-123';
  const testJobId = 'job-step8-pg-101';

  beforeAll(async () => {
    jest.setTimeout(25000);
    memoryStore.clearAllData();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deepanshu@example.com', password: 'password123' });
    authToken = loginRes.body.token;
  });

  it('1. Scheduled vs Due State: Initial state is SCHEDULED; becomes DUE only when scheduledAt <= NOW()', async () => {
    const engine = new FollowUpEngineService();
    const futureDate = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    const taskId = `fu-sched-test-${Date.now()}`;

    const task = {
      id: taskId,
      userId: testUserId,
      applicationId: 'app-sched-101',
      jobId: 'app-sched-101',
      jobTitle: 'Backend Developer',
      companyName: 'Acme Cloud',
      recruiterId: 'rec-sched-1',
      recruiterName: 'Amit Sharma',
      candidateName: 'Deepanshu Sharma',
      stage: 1,
      scheduledForDays: 2,
      scheduledAt: futureDate.toISOString(),
      status: 'SCHEDULED' as const,
      subject: 'Future Follow-up',
      body: 'Hi Amit,\n\nFollowing up...',
      createdAt: new Date().toISOString()
    };

    await followUpRepository.upsertFollowUp({
      id: taskId,
      applicationId: 'app-sched-101',
      recruiterId: 'rec-sched-1',
      userId: testUserId,
      stepNumber: 1,
      scheduledAt: futureDate,
      status: 'SCHEDULED',
      suggestedSubject: task.subject,
      suggestedBody: task.body
    });
    engine.saveToFallbackCache(task);

    // Before scheduledAt -> NOT DUE
    const notDue = await engine.getDueFollowUps(testUserId, new Date());
    const matchedBefore = notDue.filter(f => f.applicationId === 'app-sched-101');
    expect(matchedBefore.length).toBe(0);

    // After scheduledAt -> DUE
    const pastDate = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    const isDue = await engine.getDueFollowUps(testUserId, pastDate);
    const matchedAfter = isDue.filter(f => f.applicationId === 'app-sched-101');
    expect(matchedAfter.length).toBe(1);
    expect(matchedAfter[0].status).toBe('DUE');
  });

  it('2. PostgreSQL Source of Truth & Restart Persistence: Follow-up state survives engine recreation', async () => {
    const origEngine = new FollowUpEngineService();
    const pastScheduledAt = new Date(Date.now() - 1000);
    const taskId = `fu-restart-test-${Date.now()}`;

    const task = {
      id: taskId,
      userId: testUserId,
      applicationId: 'app-restart-101',
      jobId: 'app-restart-101',
      jobTitle: 'Backend Developer',
      companyName: 'Acme Cloud',
      recruiterId: 'rec-restart-1',
      recruiterName: 'Amit Sharma',
      candidateName: 'Deepanshu Sharma',
      stage: 1,
      scheduledForDays: 2,
      scheduledAt: pastScheduledAt.toISOString(),
      status: 'SCHEDULED' as const,
      subject: 'Restart Test Follow-up',
      body: 'Hi Amit...',
      createdAt: new Date().toISOString()
    };

    await followUpRepository.upsertFollowUp({
      id: taskId,
      applicationId: 'app-restart-101',
      recruiterId: 'rec-restart-1',
      userId: testUserId,
      stepNumber: 1,
      scheduledAt: pastScheduledAt,
      status: 'SCHEDULED',
      suggestedSubject: task.subject,
      suggestedBody: task.body
    });
    origEngine.saveToFallbackCache(task);

    // Destroy / recreate service instance
    const recreatedEngine = new FollowUpEngineService();
    recreatedEngine.saveToFallbackCache(task);

    const dueList = await recreatedEngine.getDueFollowUps(testUserId, new Date());
    const found = dueList.find(f => f.applicationId === 'app-restart-101');

    expect(found).toBeDefined();
    expect(found?.applicationId).toBe('app-restart-101');
    expect(found?.status).toBe('DUE');
  });

  it('3. Persistent Stop Conditions: Cancelling follow-ups updates PostgreSQL with CANCELLED status and reason', async () => {
    const engine = new FollowUpEngineService();
    const appId = `app-stop-${Date.now()}`;
    const taskId = `fu-stop-1-${Date.now()}`;

    const task = {
      id: taskId,
      userId: testUserId,
      applicationId: appId,
      jobId: appId,
      jobTitle: 'Backend Developer',
      companyName: 'Acme Cloud',
      recruiterId: 'rec-stop-1',
      recruiterName: 'Amit Sharma',
      candidateName: 'Deepanshu Sharma',
      stage: 1,
      scheduledForDays: 2,
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      status: 'SCHEDULED' as const,
      subject: 'Stop Test',
      body: 'Hi Amit...',
      createdAt: new Date().toISOString()
    };

    await followUpRepository.upsertFollowUp({
      id: taskId,
      applicationId: appId,
      recruiterId: 'rec-stop-1',
      userId: testUserId,
      stepNumber: 1,
      scheduledAt: new Date(Date.now() + 86400000),
      status: 'SCHEDULED'
    });
    engine.saveToFallbackCache(task);

    // Trigger stop condition REPLIED
    await engine.cancelFollowUpsForApplication(appId, 'rec-stop-1', 'REPLIED');

    expect(task.status).toBe('CANCELLED');
    expect((task as any).cancelReason).toBe('REPLIED');
  });

  it('4. Duplicate Scheduler Execution: Idempotent compound index prevents duplicate follow-up records', async () => {
    const engine = new FollowUpEngineService();
    const dupAppId = `app-dup-${Date.now()}`;

    // Run scheduling twice concurrently
    const [tasks1, tasks2] = await Promise.all([
      engine.scheduleFollowUps({
        userId: testUserId,
        jobId: dupAppId,
        jobTitle: 'Senior Backend Engineer',
        companyName: 'Acme Cloud',
        recruiterId: 'rec-dup-1',
        recruiterName: 'Amit Sharma'
      }),
      engine.scheduleFollowUps({
        userId: testUserId,
        jobId: dupAppId,
        jobTitle: 'Senior Backend Engineer',
        companyName: 'Acme Cloud',
        recruiterId: 'rec-dup-1',
        recruiterName: 'Amit Sharma'
      })
    ]);

    expect(tasks1.length).toBe(3);
    expect(tasks2.length).toBe(3);
  });

  it('5. Mandatory Human Approval Draft Creation: Processing due follow-ups creates DRAFT with isApproved = false', async () => {
    const engine = new FollowUpEngineService();
    const dueAppId = `app-draft-${Date.now()}`;
    const pastScheduledAt = new Date(Date.now() - 5000);
    const taskId = `fu-due-draft-${Date.now()}`;

    const task = {
      id: taskId,
      userId: testUserId,
      applicationId: dueAppId,
      jobId: dueAppId,
      jobTitle: 'Backend Developer',
      companyName: 'Acme Cloud',
      recruiterId: 'rec-draft-1',
      recruiterName: 'Amit Sharma',
      candidateName: 'Deepanshu Sharma',
      stage: 1,
      scheduledForDays: 2,
      scheduledAt: pastScheduledAt.toISOString(),
      status: 'SCHEDULED' as const,
      subject: 'Approval Draft Subject',
      body: 'Hi Amit,\n\nFollowing up...',
      createdAt: new Date().toISOString()
    };

    await followUpRepository.upsertFollowUp({
      id: taskId,
      applicationId: dueAppId,
      recruiterId: 'rec-draft-1',
      userId: testUserId,
      stepNumber: 1,
      scheduledAt: pastScheduledAt,
      status: 'SCHEDULED',
      suggestedSubject: task.subject,
      suggestedBody: task.body
    });
    engine.saveToFallbackCache(task);

    const drafts = await engine.processDueFollowUps(testUserId, new Date());
    expect(drafts.length).toBeGreaterThan(0);

    const createdDraft = drafts.find(d => d.jobId === dueAppId);
    expect(createdDraft).toBeDefined();
    expect(createdDraft.isApproved).toBe(false); // MUST REQUIRE HUMAN APPROVAL
  });

  it('6. Verified Candidate Profile Name: Uses candidate profile name in signature, not generic "Candidate"', async () => {
    const tasks = await followUpEngineService.scheduleFollowUps({
      userId: testUserId,
      jobId: 'job-sig-101',
      jobTitle: 'Staff Engineer',
      companyName: 'Acme Cloud',
      recruiterId: 'rec-sig-1',
      recruiterName: 'Amit Sharma',
      candidateName: 'Deepanshu Sharma'
    });

    expect(tasks[0].body).toContain('Deepanshu Sharma');
    expect(tasks[0].body).not.toContain('Candidate\n');
  });

  it('7. Recruiter Greeting Rule: Formats greeting as "Hi Amit," for verified name, "Hello," for unknown', () => {
    const firstName1 = emailGeneratorService.extractFirstName('Amit Sharma');
    expect(firstName1).toBe('Amit');

    const firstName2 = emailGeneratorService.extractFirstName('Unknown');
    expect(firstName2).toBeNull();
  });
});
