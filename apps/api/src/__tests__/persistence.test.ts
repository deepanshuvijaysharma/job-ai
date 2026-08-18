import request from 'supertest';
import { app } from '../app';
import { dbRepository } from '../services/db/prismaRepository';
import { memoryStore } from '../services/store';

describe('JobHunter AI Step 2: Database & Persistent Storage Suite', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    memoryStore.clearAllData();
  });

  it('1. Create user & authenticate', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'persist.test@example.com',
        name: 'Persistent Tester',
        password: 'password123'
      });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    authToken = res.body.token;
    testUserId = res.body.user.id;
  });

  it('2. Create / update profile in persistent repository', async () => {
    const profileData = {
      phone: '+91 9998887770',
      location: 'Noida',
      preferredLocations: ['Noida', 'Remote'],
      experienceYears: 3.0,
      targetRoles: ['Senior Backend Engineer', 'Backend Developer', 'Node.js Developer'],
      salaryMin: 900000,
      salaryMax: 1500000
    };

    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send(profileData);

    expect(res.status).toBe(200);
    expect(res.body.experienceYears).toBe(3.0);

    // Verify persistence via repository
    const fetched = await dbRepository.getProfile(testUserId);
    expect(fetched).toBeDefined();
  });

  it('3. Upload resume & persist extracted AI data', async () => {
    const res = await request(app)
      .post('/api/profile/resumes/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Senior Backend Node.js Resume',
        rawText: 'Senior Backend Engineer with Node.js, Express, PostgreSQL, Redis, Docker, and REST APIs.'
      });

    expect(res.status).toBe(201);
    expect(res.body.resume.title).toBe('Senior Backend Node.js Resume');

    const resumesRes = await request(app)
      .get('/api/profile/resumes')
      .set('Authorization', `Bearer ${authToken}`);

    expect(resumesRes.body.length).toBeGreaterThan(0);
  });

  it('4. Import job, calculate match, and verify job persistence', async () => {
    const res = await request(app)
      .post('/api/jobs/import')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        url: 'https://careers.acme.com/jobs/backend-engineer-99',
        title: 'Senior Backend Engineer',
        companyName: 'Acme Enterprise',
        location: 'Noida / Remote',
        description: 'Build scalable Node.js microservices and PostgreSQL queries.',
        requiredSkills: ['Node.js', 'PostgreSQL', 'Express']
      });

    expect(res.status).toBe(201);
    const jobId = res.body.job.id;

    // Verify job can be queried back
    const getJobRes = await request(app)
      .get(`/api/jobs/${jobId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(getJobRes.status).toBe(200);
    expect(getJobRes.body.title).toBe('Senior Backend Engineer');
    expect(getJobRes.body.matchScore.overallScore).toBeGreaterThan(50);
  });

  it('5. Create application & verify status progression persistence', async () => {
    const jobsRes = await request(app)
      .get('/api/jobs')
      .set('Authorization', `Bearer ${authToken}`);

    const job = jobsRes.body[0];

    const appRes = await request(app)
      .post('/api/applications/status')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        jobId: job.id,
        status: 'APPLIED',
        notes: 'Submitted application on career page.'
      });

    expect(appRes.status).toBe(200);
    expect(appRes.body.status).toBe('APPLIED');

    // Query list to verify application persists
    const listRes = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${authToken}`);

    expect(listRes.body.length).toBeGreaterThan(0);
    expect(listRes.body[0].jobId).toBe(job.id);
  });
});
