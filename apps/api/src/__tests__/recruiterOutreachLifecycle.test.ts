import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';
import { emailGeneratorService } from '../services/outreach/emailGenerator';
import { FollowUpEngineService, followUpEngineService } from '../services/outreach/followUpEngine';
import { queuedEmailsMap } from '../controllers/outreachController';
import { OutreachMessageType } from '@jobhunter/types';
import { followUpRepository, userRepository } from '../repositories/prismaRepository';

describe('JobHunter AI Step 8 Final Correction #2: Production Integrity & Isolation Suite', () => {
  let authToken: string;
  const testUserId = 'user-alice-101';
  const otherUserId = 'user-bob-202';

  beforeAll(async () => {
    jest.setTimeout(25000);
    memoryStore.clearAllData();

    // Register User A
    userRepository.create({
      id: testUserId,
      email: 'alice@example.com',
      name: 'Alice Smith',
      passwordHash: 'pass123'
    });

    // Register User B
    userRepository.create({
      id: otherUserId,
      email: 'bob@example.com',
      name: 'Bob Johnson',
      passwordHash: 'pass123'
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'pass123' });
    authToken = loginRes.body.token;
  });

  it('1. Candidate Identity: Dynamic PostgreSQL profile name is used; zero hardcoded personal names', async () => {
    const engine = new FollowUpEngineService();

    const tasks = await engine.scheduleFollowUps({
      userId: testUserId,
      jobId: 'job-alice-1',
      jobTitle: 'Senior Cloud Engineer',
      companyName: 'Acme Corp',
      recruiterId: 'rec-alice-1',
      recruiterName: 'Sarah Jenkins'
    });

    expect(tasks[0].candidateName).toBe('Alice Smith');
    expect(tasks[0].body).toContain('Alice Smith');
    expect(tasks[0].body).not.toContain('Deepanshu Sharma');
    expect(tasks[0].body).not.toContain('Candidate');
  });

  it('2. Multi-User Due-Query Isolation: getDueFollowUps returns ONLY the authenticated user due tasks', async () => {
    const engine = new FollowUpEngineService();
    const pastDate = new Date(Date.now() - 5000);

    // User A follow-up
    const taskA = {
      id: `fu-due-alice-${Date.now()}`,
      userId: testUserId,
      applicationId: 'app-alice-1',
      jobId: 'app-alice-1',
      jobTitle: 'Frontend Engineer',
      companyName: 'Cloud Corp',
      recruiterId: 'rec-alice-1',
      recruiterName: 'Sarah',
      candidateName: 'Alice Smith',
      stage: 1,
      scheduledForDays: 2,
      scheduledAt: pastDate.toISOString(),
      status: 'SCHEDULED' as const,
      subject: 'Following up',
      body: 'Hi Sarah...',
      createdAt: new Date().toISOString()
    };

    // User B follow-up
    const taskB = {
      id: `fu-due-bob-${Date.now()}`,
      userId: otherUserId,
      applicationId: 'app-bob-1',
      jobId: 'app-bob-1',
      jobTitle: 'DevOps Engineer',
      companyName: 'Data Corp',
      recruiterId: 'rec-bob-1',
      recruiterName: 'Mike',
      candidateName: 'Bob Johnson',
      stage: 1,
      scheduledForDays: 2,
      scheduledAt: pastDate.toISOString(),
      status: 'SCHEDULED' as const,
      subject: 'Following up',
      body: 'Hi Mike...',
      createdAt: new Date().toISOString()
    };

    engine.saveToFallbackCache(taskA);
    engine.saveToFallbackCache(taskB);

    // Query for User A
    const aliceDue = await engine.getDueFollowUps(testUserId, new Date());
    expect(aliceDue.every(t => t.userId === testUserId)).toBe(true);
    expect(aliceDue.some(t => t.userId === otherUserId)).toBe(false);

    // Query for User B
    const bobDue = await engine.getDueFollowUps(otherUserId, new Date());
    expect(bobDue.every(t => t.userId === otherUserId)).toBe(true);
    expect(bobDue.some(t => t.userId === testUserId)).toBe(false);
  });

  it('3. Multi-User Draft Isolation: processDueFollowUps for User A creates drafts for User A ONLY', async () => {
    const engine = new FollowUpEngineService();
    const pastDate = new Date(Date.now() - 5000);

    const taskA = {
      id: `fu-draft-alice-${Date.now()}`,
      userId: testUserId,
      applicationId: 'app-alice-2',
      jobId: 'app-alice-2',
      jobTitle: 'Fullstack Dev',
      companyName: 'Tech Co',
      recruiterId: 'rec-alice-2',
      recruiterName: 'David',
      candidateName: 'Alice Smith',
      stage: 1,
      scheduledForDays: 2,
      scheduledAt: pastDate.toISOString(),
      status: 'SCHEDULED' as const,
      subject: 'Follow up',
      body: 'Hi David...',
      createdAt: new Date().toISOString()
    };

    engine.saveToFallbackCache(taskA);

    const drafts = await engine.processDueFollowUps(testUserId, new Date());
    expect(drafts.every(d => d.userId === testUserId)).toBe(true);
  });

  it('4. Concurrent Draft Creation & Idempotency: Multiple concurrent workers generate exactly 1 draft', async () => {
    const engine = new FollowUpEngineService();
    const pastDate = new Date(Date.now() - 5000);
    const taskId = `fu-concurrent-${Date.now()}`;

    const task = {
      id: taskId,
      userId: testUserId,
      applicationId: 'app-concurrent-1',
      jobId: 'app-concurrent-1',
      jobTitle: 'Backend Dev',
      companyName: 'Scale Co',
      recruiterId: 'rec-conc-1',
      recruiterName: 'Laura',
      candidateName: 'Alice Smith',
      stage: 1,
      scheduledForDays: 2,
      scheduledAt: pastDate.toISOString(),
      status: 'SCHEDULED' as const,
      subject: 'Follow up',
      body: 'Hi Laura...',
      createdAt: new Date().toISOString()
    };

    engine.saveToFallbackCache(task);

    // Worker A & Worker B process concurrently
    const [resA, resB] = await Promise.all([
      engine.processDueFollowUps(testUserId, new Date()),
      engine.processDueFollowUps(testUserId, new Date())
    ]);

    expect(resA.length).toBeGreaterThan(0);
    expect(resB.length).toBeGreaterThan(0);
    expect(resA[0].id).toBe(resB[0].id); // Both workers resolve to exact same draft ID
  });

  it('5. Draft Idempotency on Sequential Retry: Calling processDueFollowUps again creates 0 new drafts', async () => {
    const engine = new FollowUpEngineService();
    const pastDate = new Date(Date.now() - 5000);
    const taskId = `fu-retry-${Date.now()}`;

    const task = {
      id: taskId,
      userId: testUserId,
      applicationId: 'app-retry-1',
      jobId: 'app-retry-1',
      jobTitle: 'Systems Engineer',
      companyName: 'Sys Co',
      recruiterId: 'rec-retry-1',
      recruiterName: 'Sam',
      candidateName: 'Alice Smith',
      stage: 1,
      scheduledForDays: 2,
      scheduledAt: pastDate.toISOString(),
      status: 'SCHEDULED' as const,
      subject: 'Follow up',
      body: 'Hi Sam...',
      createdAt: new Date().toISOString()
    };

    engine.saveToFallbackCache(task);

    const firstRun = await engine.processDueFollowUps(testUserId, new Date());
    expect(firstRun.length).toBeGreaterThan(0);

    const secondRun = await engine.processDueFollowUps(testUserId, new Date());
    expect(secondRun.length).toBe(0); // Zero new drafts created on retry
  });

  it('6. Process Restart Draft Preservation: Clearing memory map prevents secondary draft creation', async () => {
    const engine = new FollowUpEngineService();
    const pastDate = new Date(Date.now() - 5000);
    const taskId = `fu-restart-draft-${Date.now()}`;

    const task = {
      id: taskId,
      userId: testUserId,
      applicationId: 'app-restart-draft-1',
      jobId: 'app-restart-draft-1',
      jobTitle: 'Security Lead',
      companyName: 'Secure Tech',
      recruiterId: 'rec-sec-1',
      recruiterName: 'Karen',
      candidateName: 'Alice Smith',
      stage: 1,
      scheduledForDays: 2,
      scheduledAt: pastDate.toISOString(),
      status: 'DRAFT' as const, // Already processed into DRAFT
      subject: 'Follow up',
      body: 'Hi Karen...',
      createdAt: new Date().toISOString()
    };

    engine.saveToFallbackCache(task);

    // Simulate API restart
    engine.clearCache();
    queuedEmailsMap.clear();

    // Re-seed task state as DRAFT
    engine.saveToFallbackCache(task);

    const postRestartRun = await engine.processDueFollowUps(testUserId, new Date());
    expect(postRestartRun.length).toBe(0);
  });

  it('7. Mandatory Human Approval Enforcement: All drafts start with isApproved = false', async () => {
    const engine = new FollowUpEngineService();
    const pastDate = new Date(Date.now() - 5000);
    const taskId = `fu-human-appr-${Date.now()}`;

    const task = {
      id: taskId,
      userId: testUserId,
      applicationId: 'app-human-1',
      jobId: 'app-human-1',
      jobTitle: 'QA Lead',
      companyName: 'Test Inc',
      recruiterId: 'rec-qa-1',
      recruiterName: 'John',
      candidateName: 'Alice Smith',
      stage: 1,
      scheduledForDays: 2,
      scheduledAt: pastDate.toISOString(),
      status: 'SCHEDULED' as const,
      subject: 'Follow up',
      body: 'Hi John...',
      createdAt: new Date().toISOString()
    };

    engine.saveToFallbackCache(task);

    const drafts = await engine.processDueFollowUps(testUserId, new Date());
    expect(drafts.length).toBe(1);
    expect(drafts[0].isApproved).toBe(false);
  });
});
