import crypto from 'crypto';

import { getEncryptionSecret } from '../../config/securityConfig';

const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

export interface OAuthStatePayload {
  userId: string;
  provider: 'gmail' | 'outlook';
  timestamp: number;
  nonce: string;
}

export class OAuthStateService {
  private computeHmac(payloadStr: string): string {
    return crypto.createHmac('sha256', getEncryptionSecret()).update(payloadStr).digest('hex');
  }

  public generateState(userId: string, provider: 'gmail' | 'outlook'): string {
    const payload: OAuthStatePayload = {
      userId,
      provider,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex')
    };

    const payloadStr = JSON.stringify(payload);
    const base64Payload = Buffer.from(payloadStr).toString('base64url');
    const signature = this.computeHmac(base64Payload);

    return `${base64Payload}.${signature}`;
  }

  public validateState(stateToken: string, expectedUserId: string, expectedProvider: 'gmail' | 'outlook'): { isValid: boolean; error?: string } {
    if (!stateToken || typeof stateToken !== 'string') {
      return { isValid: false, error: 'OAuth state parameter is missing' };
    }

    const parts = stateToken.split('.');
    if (parts.length !== 2) {
      return { isValid: false, error: 'Malformed OAuth state parameter' };
    }

    const [base64Payload, signature] = parts;
    const expectedSignature = this.computeHmac(base64Payload);

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return { isValid: false, error: 'Invalid OAuth state signature (Possible CSRF or forgery attempt)' };
    }

    try {
      const payloadStr = Buffer.from(base64Payload, 'base64url').toString('utf8');
      const payload: OAuthStatePayload = JSON.parse(payloadStr);

      if (payload.userId !== expectedUserId) {
        return { isValid: false, error: 'OAuth state user mismatch' };
      }

      if (payload.provider !== expectedProvider) {
        return { isValid: false, error: 'OAuth state provider mismatch' };
      }

      if (Date.now() - payload.timestamp > STATE_EXPIRY_MS) {
        return { isValid: false, error: 'Expired OAuth state parameter' };
      }

      return { isValid: true };
    } catch {
      return { isValid: false, error: 'Failed to decode OAuth state payload' };
    }
  }
}

export const oauthStateService = new OAuthStateService();
