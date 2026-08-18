export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is missing in production environment');
    }
    return 'dev-secret-jwt-key-jobhunter-ai-only-for-development';
  }
  return secret;
}

export function getEncryptionSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL CONFIGURATION ERROR: ENCRYPTION_SECRET environment variable is missing in production environment');
    }
    return 'dev-token-encryption-secret-key-32-chars!!';
  }
  return secret;
}

export function getCORSOrigins(): string[] {
  const configured = process.env.CORS_ORIGIN;
  if (configured) {
    return configured.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (process.env.NODE_ENV === 'production') {
    return []; // Fail closed in production if CORS_ORIGIN is missing
  }
  return ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'];
}
