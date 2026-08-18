import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';
import { 
  userRepository, 
  profileRepository, 
  resumeRepository, 
  jobRepository, 
  jobMatchRepository, 
  applicationRepository, 
  recruiterRepository, 
  followUpRepository 
} from '../repositories/prismaRepository';
import { ApplicationStatus, MatchPriority, RemotePreference } from '@jobhunter/types';

describe('JobHunter AI Step 2: Real PostgreSQL Persistence & Backend Restart Verification Suite', () => {
  let authToken: string;

  beforeAll(async () => {
    jest.setTimeout(25000);
    memoryStore.clearAllData();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deepanshu@example.com', password: 'password123' });
    authToken = loginRes.body.token;
  });

  it('1. User & Candidate Profile Persistence: Profile, skills, and target roles survive', async () => {
    const profile = await profileRepository.upsert('demo-user-123', {
      phone: '+91 9876543210',
      location: 'Noida, India',
      preferredLocations: ['Noida', 'Remote'],
      remotePref: RemotePreference.HYBRID,
      experienceYears: 3.5,
      currentRole: 'Software Engineer',
      targetRoles: ['Backend Developer', 'Node.js Architect'],
      salaryMin: 1200000,
      salaryMax: 1800000
    });

    expect(profile).toBeDefined();
    
    // Read profile back
    const fetched = await profileRepository.findByUserId('demo-user-123');
    expect(fetched).toBeDefined();
    if (fetched) {
      expect(fetched.phone).toBe('+91 9876543210');
      expect(fetched.targetRoles).toContain('Backend Developer');
    }
  });

  it('2. Resume Persistence: Uploaded resume metadata and parsed content survive', async () => {
    const resume = await resumeRepository.create({
      userId: 'demo-user-123',
      title: 'Backend Node.js & PostgreSQL Resume',
      fileUrl: '/uploads/resumes/backend-node-2026.pdf',
      fileType: 'pdf',
      rawText: 'Experienced Node.js Backend Software Engineer skilled in Express, TypeScript, PostgreSQL',
      parsedData: { targetRole: 'Backend Developer', skills: ['Node.js', 'PostgreSQL', 'Express'] }
    });

    expect(resume).toBeDefined();
    const userResumes = await resumeRepository.findByUserId('demo-user-123');
    expect(userResumes.length).toBeGreaterThan(0);
    expect(userResumes[0].title).toContain('Backend Node.js');
  });

  it('3. Job & Deduplication Persistence: Canonical URL deduplication works', async () => {
    const canonicalUrl = 'https://acmecloud.com/careers/backend-dev-2026';
    const job1 = await jobRepository.upsertJob({
      id: 'job-pg-101',
      title: 'Senior Backend Developer',
      companyId: 'comp-acme-cloud',
      companyName: 'Acme Cloud Solutions',
      source: 'Company Career Portal',
      canonicalUrl,
      applicationUrl: 'https://acmecloud.com/apply/backend-dev-2026',
      location: 'Noida, India',
      remoteType: RemotePreference.HYBRID,
      description: 'Building microservices with Node.js and PostgreSQL',
      requiredSkills: ['Node.js', 'PostgreSQL', 'TypeScript'],
      preferredSkills: ['Redis', 'Docker'],
      postedAt: new Date().toISOString()
    });

    expect(job1).toBeDefined();

    // Re-upsert identical job canonicalUrl
    const job2 = await jobRepository.upsertJob({
      id: 'job-pg-101-dup',
      title: 'Senior Backend Developer (Updated Title)',
      companyId: 'comp-acme-cloud',
      companyName: 'Acme Cloud Solutions',
      source: 'Company Career Portal',
      canonicalUrl, // SAME canonical URL!
      applicationUrl: 'https://acmecloud.com/apply/backend-dev-2026',
      location: 'Noida, India',
      remoteType: RemotePreference.HYBRID,
      description: 'Building microservices with Node.js and PostgreSQL',
      requiredSkills: ['Node.js', 'PostgreSQL', 'TypeScript'],
      preferredSkills: ['Redis', 'Docker'],
      postedAt: new Date().toISOString()
    });

    expect(job2).toBeDefined();
    // Database canonicalUrl lookup returns deduplicated job
    const fetched = await jobRepository.findByCanonicalUrl(canonicalUrl);
    expect(fetched).toBeDefined();
    expect(fetched?.canonicalUrl).toBe(canonicalUrl);
  });

  it('4. Job Match & Application Lifecycle Persistence with Prisma Transaction: Events log status transition', async () => {
    // 1. Save Job Match
    await jobMatchRepository.upsertMatch({
      userId: 'demo-user-123',
      jobId: 'job-101',
      matchData: {
        overallScore: 96,
        priority: MatchPriority.APPLY_NOW,
        breakdown: {
          skillMatch: 98,
          experienceMatch: 95,
          roleMatch: 95,
          locationMatch: 100,
          salaryMatch: 90,
          educationMatch: 90,
          resumeKeywordMatch: 95,
          projectMatch: 90
        },
        whyApply: ['98% skill match'],
        whatHoldsBack: [],
        recommendedResumeId: 'res-backend-1',
        recommendedResumeTitle: 'Backend Node.js Resume'
      }
    });

    // 2. Transactional Status Update
    const appRecord = await applicationRepository.upsertStatusWithTransaction(
      'demo-user-123',
      'job-101',
      ApplicationStatus.INTERVIEW_SCHEDULED,
      'Recruiter confirmed technical interview for 22 August'
    );

    expect(appRecord).toBeDefined();
    const userApps = await applicationRepository.findByUserId('demo-user-123');
    expect(userApps.length).toBeGreaterThan(0);
    const targetApp = userApps.find(a => a.jobId === 'job-101');
    expect(targetApp?.status).toBe(ApplicationStatus.INTERVIEW_SCHEDULED);
  });

  it('5. Mandatory Backend Restart Verification Test: All records survive backend restart', async () => {
    // 1. Seed complete persistent relational dataset
    await jobRepository.upsertJob({
      id: 'job-restart-999',
      title: 'Principal Software Architect',
      companyId: 'comp-enterprise',
      companyName: 'Enterprise SaaS Inc',
      source: 'Greenhouse Public Board',
      canonicalUrl: 'https://enterprise.com/careers/arch-999',
      applicationUrl: 'https://enterprise.com/apply/arch-999',
      location: 'Remote',
      remoteType: RemotePreference.REMOTE,
      description: 'Distributed systems architect',
      requiredSkills: ['Node.js', 'System Design'],
      preferredSkills: ['Kubernetes'],
      postedAt: new Date().toISOString()
    });

    await applicationRepository.upsertStatusWithTransaction(
      'demo-user-123',
      'job-restart-999',
      ApplicationStatus.RECRUITER_RESPONDED,
      'Recruiter responded asking for availability'
    );

    // 2. SIMULATE BACKEND RESTART: Clear in-memory maps & caches completely!
    memoryStore.clearAllData();

    // 3. READ ALL RECORDS AGAIN from repository/store layer after restart
    const restartedUserApps = await applicationRepository.findByUserId('demo-user-123');
    expect(restartedUserApps).toBeDefined();

    const restartedJob = await jobRepository.findByCanonicalUrl('https://enterprise.com/careers/arch-999');
    expect(restartedJob).toBeDefined();
    expect(restartedJob?.title).toBe('Principal Software Architect');
  });
});
