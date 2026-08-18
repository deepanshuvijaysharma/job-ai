import request from 'supertest';
import { app } from '../app';
import { getJwtSecret, getEncryptionSecret, getCORSOrigins } from '../config/securityConfig';
import { tokenEncryption } from '../services/email/tokenEncryption';
import { emailOAuthService } from '../services/email/emailOAuthService';

describe('Step 11 Final Correction: Security Configuration Audit Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('1. Production + missing JWT_SECRET: Fails fast with clear configuration error', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;

    expect(() => getJwtSecret()).toThrow('FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is missing in production environment');
  });

  it('2. Production + missing ENCRYPTION_SECRET: Fails fast with clear configuration error', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENCRYPTION_SECRET;

    expect(() => getEncryptionSecret()).toThrow('FATAL CONFIGURATION ERROR: ENCRYPTION_SECRET environment variable is missing in production environment');
  });

  it('3. Valid encryption secret: Encrypts and decrypts OAuth tokens successfully using AES-256-CBC', () => {
    process.env.ENCRYPTION_SECRET = 'test-secret-key-32-characters-long!!';
    const plainToken = 'ya29.a0AfH6SMBx_sample_oauth_token_12345';
    
    const encrypted = tokenEncryption.encryptToken(plainToken);
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toEqual(plainToken);
    expect(encrypted).toContain(':'); // IV:Ciphertext structure

    const decrypted = tokenEncryption.decryptToken(encrypted);
    expect(decrypted).toEqual(plainToken);
  });

  it('4. Token Privacy: Connected accounts DTOs never expose raw or encrypted tokens in API responses', async () => {
    const userId = 'demo-user-security-123';
    emailOAuthService.saveToLocalCache({
      id: 'acc-sec-1',
      userId,
      provider: 'gmail',
      emailAddress: 'secuser@gmail.com',
      encryptedAccessToken: tokenEncryption.encryptToken('secret-access-token-999'),
      encryptedRefreshToken: tokenEncryption.encryptToken('secret-refresh-token-999'),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      isDefault: true,
      isConnected: true,
      dailySentCount: 0,
      createdAt: new Date().toISOString()
    });

    const publicAccounts = await emailOAuthService.getUserConnectedAccounts(userId);
    expect(publicAccounts.length).toBeGreaterThan(0);
    const acc = publicAccounts[0];

    expect(acc.emailAddress).toBe('secuser@gmail.com');
    expect((acc as any).encryptedAccessToken).toBeUndefined();
    expect((acc as any).encryptedRefreshToken).toBeUndefined();
    expect((acc as any).accessToken).toBeUndefined();
    expect((acc as any).refreshToken).toBeUndefined();
  });

  it('5. CORS Allowed Origin: Permitted origin receives CORS headers', async () => {
    process.env.CORS_ORIGIN = 'http://localhost:3000,https://app.jobhunter.ai';
    
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://app.jobhunter.ai');

    expect(res.headers['access-control-allow-origin']).toBe('https://app.jobhunter.ai');
  });

  it('6. CORS Untrusted Origin: Untrusted origin is rejected without permissive CORS header', async () => {
    process.env.CORS_ORIGIN = 'https://app.jobhunter.ai';

    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://malicious-site.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('7. Production without CORS_ORIGIN: Fails closed and returns no wildcard CORS header', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ORIGIN;

    const origins = getCORSOrigins();
    expect(origins).toEqual([]); // Fails closed with 0 permitted origins

    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://untrusted.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });
});
