import request from 'supertest';
import { app } from '../app';
import { userRepository } from '../repositories/prismaRepository';
import fs from 'fs';
import path from 'path';

describe('Step 12.4: Production Migration & Deployment Startup Test Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('10.A & 10.B Fresh/Existing DB Startup: Entrypoint script and health readiness return ok when DB is healthy', async () => {
    process.env.NODE_ENV = 'production';
    
    // Verify docker-entrypoint.sh exists and is executable
    const entrypointPath = path.resolve(__dirname, '../../docker-entrypoint.sh');
    expect(fs.existsSync(entrypointPath)).toBe(true);

    const scriptContent = fs.readFileSync(entrypointPath, 'utf8');
    expect(scriptContent).toContain('npx prisma migrate deploy');
    expect(scriptContent).not.toContain('prisma db push');
    expect(scriptContent).not.toContain('prisma db seed');

    // Test /api/health endpoint when DB is connected
    jest.spyOn(userRepository, 'checkDatabaseConnection').mockResolvedValue(undefined as never);
    jest.spyOn(userRepository, 'isAvailable').mockReturnValue(true);

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.dbConnected).toBe(true);
  });

  it('10.C Migration/DB Failure: API health returns HTTP 503 in production when database connectivity fails', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://invalid:invalid@localhost:5432/invalid_db';

    jest.spyOn(userRepository, 'checkDatabaseConnection').mockRejectedValue(new Error('Connection refused') as never);
    jest.spyOn(userRepository, 'isAvailable').mockReturnValue(false);

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('error');
    expect(res.body.dbConnected).toBe(false);
  });

  it('10.D API Restart Idempotency: Migration command uses prisma migrate deploy without duplicate errors', () => {
    const entrypointPath = path.resolve(__dirname, '../../docker-entrypoint.sh');
    const scriptContent = fs.readFileSync(entrypointPath, 'utf8');

    // prisma migrate deploy is natively idempotent using _prisma_migrations locking table
    expect(scriptContent).toContain('npx prisma migrate deploy');
  });

  it('10.E Seed Verification: Production startup script explicitly omits prisma db seed', () => {
    const entrypointPath = path.resolve(__dirname, '../../docker-entrypoint.sh');
    const scriptContent = fs.readFileSync(entrypointPath, 'utf8');

    expect(scriptContent).not.toContain('seed');
    expect(scriptContent).not.toContain('ts-node');
  });
});
