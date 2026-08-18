import request from 'supertest';
import { app } from '../app';
import { memoryStore } from '../services/store';
import { greenhouseAdapter } from '../services/job/sources/greenhouseAdapter';
import { leverAdapter } from '../services/job/sources/leverAdapter';
import { companyCareerAdapter } from '../services/job/sources/companyCareerAdapter';
import { jobDiscoveryManager } from '../services/job/jobDiscoveryManager';
import { jobDiscoveryWorker } from '../services/job/jobDiscoveryWorker';
import { deduplicationService } from '../services/job/jobIngestionService';
import { RemotePreference } from '@jobhunter/types';

describe('JobHunter AI Step 5: Real Job Discovery Engine Suite', () => {
  let authToken: string;

  beforeAll(async () => {
    memoryStore.clearAllData();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deepanshu@example.com', password: 'password123' });
    authToken = loginRes.body.token;
  });

  it('1. Pluggable Adapters: Greenhouse & Lever adapters return normalized raw jobs via real API calls', async () => {
    const ghJobs = await greenhouseAdapter.search({ boardToken: 'gitlab', limit: 2 });
    expect(ghJobs.length).toBeGreaterThan(0);
    expect(ghJobs[0].sourceId).toBe('greenhouse');
    expect(ghJobs[0].canonicalUrl).toContain('greenhouse.io');

    const leverJobs = await leverAdapter.search({ companyName: 'spotify', limit: 2 });
    expect(leverJobs.length).toBeGreaterThan(0);
    expect(leverJobs[0].sourceId).toBe('lever');
    expect(leverJobs[0].canonicalUrl).toContain('lever.co');
  }, 15000);

  it('2. Deduplication Engine & Idempotency: Prevents duplicate job ingestion on second run', () => {
    const jobSample = {
      title: 'Node.js Microservices Developer',
      companyName: 'Acme Testing Lab',
      source: 'Greenhouse Public Board',
      sourceId: 'greenhouse',
      canonicalUrl: 'https://boards.greenhouse.io/acme/jobs/999111',
      applicationUrl: 'https://boards.greenhouse.io/acme/jobs/999111#apply',
      location: 'Noida',
      remoteType: RemotePreference.HYBRID,
      description: 'Backend developer role.',
      requiredSkills: ['Node.js'],
      preferredSkills: []
    };

    const firstCheck = deduplicationService.checkJobStatus(jobSample);
    expect(firstCheck.isDuplicate).toBe(false);

    const secondCheck = deduplicationService.checkJobStatus(jobSample);
    expect(secondCheck.isDuplicate).toBe(true);
    expect(secondCheck.isUpdated).toBe(false);
  });

  it('3. Discovery Pipeline & Alert Generation: Triggers discovery and returns source health', async () => {
    const res = await request(app)
      .post('/api/jobs/discover')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        roles: ['Backend Developer', 'Node.js Developer']
      });

    expect(res.status).toBe(200);
    expect(res.body.discoveredCount).toBeGreaterThan(0);
    expect(res.body.sourceHealth).toBeDefined();

    // Verify alerts endpoint returns notifications
    const alertsRes = await request(app)
      .get('/api/jobs/alerts')
      .set('Authorization', `Bearer ${authToken}`);

    expect(alertsRes.status).toBe(200);
    expect(Array.isArray(alertsRes.body)).toBe(true);
  }, 20000);

  it('4. Source Health Monitoring API Endpoint: GET /api/jobs/sources/health', async () => {
    const healthRes = await request(app)
      .get('/api/jobs/sources/health')
      .set('Authorization', `Bearer ${authToken}`);

    expect(healthRes.status).toBe(200);
    expect(Array.isArray(healthRes.body.sources)).toBe(true);
    expect(healthRes.body.sources.some((s: any) => s.id === 'greenhouse')).toBe(true);
  });

  it('5. Source Attribution Integrity: User import explicitly marked as USER_IMPORT', async () => {
    const importRes = await request(app)
      .post('/api/jobs/import')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        url: 'https://custom-careers.com/job/unique-12345',
        title: 'Custom Imported Backend Role',
        companyName: 'Custom Client Corp'
      });

    expect(importRes.status).toBe(201);
    expect(importRes.body.job.source).toBe('User Import');
  });
});
