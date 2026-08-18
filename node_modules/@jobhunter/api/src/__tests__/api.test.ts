import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';

describe('JobHunter AI API Integration Suite', () => {
  let authToken: string;

  beforeAll(() => {
    memoryStore.seedDemoDataForTesting();
  });

  it('1. GET /api/health should return status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('2. POST /api/auth/login should authenticate default user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deepanshu@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('deepanshu@example.com');
    authToken = res.body.token;
  });

  it('3. GET /api/profile should return candidate profile', async () => {
    const res = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.targetRoles).toContain('Backend Developer');
    expect(res.body.skills.length).toBeGreaterThan(0);
  });

  it('4. GET /api/jobs should return jobs with 0-100 match scores', async () => {
    const res = await request(app)
      .get('/api/jobs')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].matchScore.overallScore).toBeGreaterThanOrEqual(90);
  });

  it('5. GET /api/analytics/daily-summary should generate morning summary', async () => {
    const res = await request(app)
      .get('/api/analytics/daily-summary')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.highMatchJobsCount).toBeGreaterThan(0);
    expect(res.body.recommendedActions.length).toBeGreaterThan(0);
  });

  it('6. POST /api/jobs/import should import job & calculate match score without duplicate', async () => {
    const res = await request(app)
      .post('/api/jobs/import')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        url: 'https://careers.google.com/jobs/results/123456789',
        title: 'Backend Software Engineer - Cloud',
        companyName: 'Google Cloud India',
        location: 'Gurgaon',
        description: 'Design distributed database services with Node.js and SQL.',
        requiredSkills: ['Node.js', 'SQL', 'TypeScript']
      });

    expect(res.status).toBe(201);
    expect(res.body.job.title).toBe('Backend Software Engineer - Cloud');
    expect(res.body.matchScore.overallScore).toBeGreaterThan(60);
  });

  it('7. GET /api/applications should list Kanban pipeline', async () => {
    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
