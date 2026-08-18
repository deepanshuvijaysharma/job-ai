import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';
import { companyWatchService } from '../services/company/companyWatchService';

describe('JobHunter AI Strategy, Company Watch, Interview Coach & Command Palette Suite', () => {
  let authToken: string;

  beforeAll(async () => {
    jest.setTimeout(20000);
    memoryStore.seedDemoDataForTesting();
    companyWatchService.seedInitialWatches();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deepanshu@example.com', password: 'password123' });
    authToken = res.body.token;
  });

  it('1. GET /api/features/companies should return watched companies list', async () => {
    const res = await request(app)
      .get('/api/features/companies')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].name).toBeDefined();
  });

  it('2. POST /api/features/companies should add new company to watchlist', async () => {
    const res = await request(app)
      .post('/api/features/companies')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Google Cloud',
        website: 'https://cloud.google.com'
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Google Cloud');
  });

  it('3. GET /api/features/interview/prep/job-101 should generate question bank & prep plan', async () => {
    const res = await request(app)
      .get('/api/features/interview/prep/job-101')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.jobTitle).toBeDefined();
    expect(res.body.questionBank.length).toBeGreaterThan(0);
  });

  it('4. POST /api/features/command should execute natural language AI command', async () => {
    const res = await request(app)
      .post('/api/features/command')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        query: 'Find my best 20 jobs today.'
      });

    expect(res.status).toBe(200);
    expect(res.body.matchedCount).toBeGreaterThan(0);
    expect(res.body.interpretation).toContain('Top 20');
  });

  it('5. GET /api/features/strategy should return yield strategy recommendations', async () => {
    const res = await request(app)
      .get('/api/features/strategy')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.strategicRecommendations.length).toBeGreaterThan(0);
  });
});
