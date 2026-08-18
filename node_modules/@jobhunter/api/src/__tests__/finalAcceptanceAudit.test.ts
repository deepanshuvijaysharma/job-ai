import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';
import { companyCareerAdapter } from '../services/job/sources/companyCareerAdapter';
import { advancedMatchingEngine } from '../services/job/advancedMatchingEngine';
import { recruiterService } from '../services/recruiter/recruiterService';
import { emailGeneratorService } from '../services/outreach/emailGenerator';
import { queuedEmailsMap } from '../controllers/outreachController';
import { emailOAuthService } from '../services/email/emailOAuthService';
import { oauthStateService } from '../services/email/oauthStateService';
import { tokenEncryption } from '../services/email/tokenEncryption';
import { emailRepository } from '../repositories/prismaRepository';
import { inboxIntelligenceService } from '../services/email/inboxIntelligence';
import { followUpEngineService } from '../services/outreach/followUpEngine';
import { RemotePreference } from '@jobhunter/types';

describe('JobHunter AI Step 10: Complete End-to-End Final Acceptance Verification Suite', () => {
  let authToken: string;

  beforeAll(async () => {
    jest.setTimeout(25000);
    memoryStore.clearAllData();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deepanshu@example.com', password: 'password123' });
    authToken = loginRes.body.token;
  });

  it('COMPLETE E2E WORKFLOW: Discovered → Matched → Recruiter → Outreach → Approval → Send → Reply → Classification → Status Update → Follow-up Stop → Interview Prep → Analytics', async () => {
    // 1. Job Discovered
    const rawJobs = await companyCareerAdapter.search({ roles: ['Backend Developer'] });
    expect(rawJobs.length).toBeGreaterThan(0);
    const rawJob = rawJobs[0];

    // 2. Job Matched (0-100 score & transparent reasoning)
    const match = advancedMatchingEngine.calculateMatch(
      {
        targetRoles: ['Senior Backend Developer', 'Backend Developer'],
        secondaryRoles: ['Full Stack Developer'],
        experienceYears: 3.5,
        skills: [
          { name: 'Node.js', yearsExperience: 3.5, proficiencyLevel: 'STRONG' },
          { name: 'Express.js', yearsExperience: 3.5, proficiencyLevel: 'STRONG' },
          { name: 'PostgreSQL', yearsExperience: 3.0, proficiencyLevel: 'STRONG' },
          { name: 'TypeScript', yearsExperience: 3.0, proficiencyLevel: 'STRONG' },
          { name: 'SQL', yearsExperience: 3.0, proficiencyLevel: 'STRONG' },
          { name: 'Redis', yearsExperience: 2.0, proficiencyLevel: 'INTERMEDIATE' },
          { name: 'Docker', yearsExperience: 2.0, proficiencyLevel: 'INTERMEDIATE' }
        ],
        preferredLocations: ['Noida', 'Remote'],
        remotePref: RemotePreference.HYBRID
      },
      rawJob
    );
    expect(match.overallScore).toBeGreaterThanOrEqual(90);

    // Save job & application to store
    const jobId = `e2e-job-${Date.now()}`;
    const appId = `e2e-app-${Date.now()}`;
    memoryStore.jobs.set(jobId, {
      id: jobId,
      title: rawJob.title,
      companyId: 'comp-acme',
      companyName: rawJob.companyName,
      source: rawJob.source,
      canonicalUrl: rawJob.canonicalUrl,
      applicationUrl: rawJob.applicationUrl,
      location: rawJob.location,
      remoteType: rawJob.remoteType,
      description: rawJob.description,
      requiredSkills: rawJob.requiredSkills,
      preferredSkills: rawJob.preferredSkills,
      postedAt: new Date().toISOString()
    });

    memoryStore.applications.set(`demo-user-123_${jobId}`, {
      id: appId,
      userId: 'demo-user-123',
      jobId,
      status: 'APPLIED',
      qualityScore: match.overallScore,
      createdAt: new Date().toISOString()
    });

    // 3. Recruiter Identified & Ranked
    const recruiters = await recruiterService.discoverAndRankRecruiters(
      { title: rawJob.title, companyName: rawJob.companyName, location: rawJob.location },
      [{ id: 'rec-e2e-1', companyId: 'comp-acme', name: 'Amit Sharma', role: 'Technical Recruiter', email: 'amit@acme.com', isVerified: true, confidence: 0.94, source: 'Career Portal' }]
    );
    expect(recruiters.length).toBeGreaterThan(0);
    const recruiter = recruiters[0].recruiter;

    // 4. Email Draft Generated
    const draft = await emailGeneratorService.generatePersonalizedEmail(
      { name: 'Deepanshu Sharma', currentRole: 'Full Stack Engineer', skills: ['Node.js', 'Express.js', 'SQL'], projects: [{ title: 'Microservices Engine' }] },
      { title: rawJob.title, companyName: rawJob.companyName, requiredSkills: rawJob.requiredSkills, location: rawJob.location },
      { name: recruiter.name, role: recruiter.role },
      'INITIAL_OUTREACH'
    );
    expect(draft.body).toContain('Hi Amit');

    // 5. User Approves Outreach Email
    const msgId = `msg-e2e-${Date.now()}`;
    queuedEmailsMap.set(msgId, {
      id: msgId,
      userId: 'demo-user-123',
      jobId,
      jobTitle: rawJob.title,
      companyName: rawJob.companyName,
      recruiterId: recruiter.id,
      recruiterName: recruiter.name,
      recruiterEmail: recruiter.email,
      recruiterRole: recruiter.role,
      subject: draft.subject,
      body: draft.body,
      templateType: 'INITIAL_OUTREACH',
      isApproved: true,
      aiReasoning: 'E2E test approval',
      confidence: 0.94,
      createdAt: new Date().toISOString()
    });

    // Schedule Follow-ups upon dispatch
    const followUps = followUpEngineService.scheduleFollowUps({
      userId: 'demo-user-123',
      jobId,
      jobTitle: rawJob.title,
      companyName: rawJob.companyName,
      recruiterId: recruiter.id,
      recruiterName: recruiter.name
    });
    expect(followUps.length).toBe(3); // Day 2, 5, 10

    // 6. Connect OAuth & Dispatch Email
    const origFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'gmail-e2e-12345' })
    } as any);

    const accState = {
      id: 'acc-e2e-gmail-101',
      userId: 'demo-user-123',
      provider: 'gmail' as const,
      emailAddress: 'deepanshu.e2e@example.com',
      encryptedAccessToken: tokenEncryption.encryptToken('valid-e2e-gmail-token'),
      encryptedRefreshToken: null,
      isDefault: true,
      isConnected: true,
      dailySentCount: 0,
      createdAt: new Date().toISOString()
    };
    await emailRepository.upsertAccount({ ...accState, encryptedRefreshToken: undefined });
    emailOAuthService.saveToLocalCache(accState);

    const dispatchLog = await emailOAuthService.dispatchApprovedOutreach('demo-user-123', msgId);
    expect(dispatchLog.status).toBe('SENT');
    expect(dispatchLog.externalMessageId).toBe('gmail-e2e-12345');
    global.fetch = origFetch;

    // 7. Recruiter Reply Arrives & AI Classifies Reply
    const incomingEmail = {
      senderEmail: recruiter.email || 'amit@acme.com',
      senderName: recruiter.name,
      subject: `Interview Invitation: ${rawJob.title}`,
      body: 'Hi Deepanshu, We loved your profile and would like to schedule an interview on 22 August at 11:00 AM via https://meet.google.com/xyz-123'
    };
    const extracted = await inboxIntelligenceService.processIncomingEmail(incomingEmail);
    expect(extracted.category).toBe('INTERVIEW_INVITATION');

    // 8. Generate Proposal & Confirm User Pipeline Transition
    const proposal = inboxIntelligenceService.createProposal('demo-user-123', extracted);
    expect(proposal.isConfirmed).toBe(false);

    const confirmedProposal = inboxIntelligenceService.confirmProposal(proposal.id);
    expect(confirmedProposal.isConfirmed).toBe(true);

    // 9. Automatic Stop Condition Suppresses Follow-Ups
    const suppressedCount = followUpEngineService.evaluateStopCondition(jobId, recruiter.id, 'REPLIED');
    expect(suppressedCount).toBeGreaterThan(0);

    // 10. AI Interview Preparation Generated
    const prepRes = await request(app)
      .get(`/api/features/interview/prep/${jobId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(prepRes.status).toBe(200);
    expect(prepRes.body.questionBank.length).toBeGreaterThan(0);

    // 11. Real Analytics Updated Dynamic Totals
    const analyticsRes = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${authToken}`);
    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.funnel.jobsDiscovered).toBeGreaterThan(0);

    // 12. Morning Dashboard & Weekly Report API Verification
    const morningRes = await request(app)
      .get('/api/analytics/morning')
      .set('Authorization', `Bearer ${authToken}`);
    expect(morningRes.status).toBe(200);
    expect(morningRes.body.greeting).toContain('GOOD MORNING');

    const weeklyRes = await request(app)
      .get('/api/analytics/weekly')
      .set('Authorization', `Bearer ${authToken}`);
    expect(weeklyRes.status).toBe(200);
    expect(weeklyRes.body.summaryMetrics.jobsDiscovered).toBeGreaterThan(0);
  });
});
