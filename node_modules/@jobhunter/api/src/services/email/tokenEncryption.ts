import crypto from 'crypto';

import { getEncryptionSecret } from '../../config/securityConfig';

const ALGORITHM = 'aes-256-cbc';

export class TokenEncryptionService {
  private getKey(): Buffer {
    return crypto.createHash('sha256').update(getEncryptionSecret()).digest();
  }

  public encryptToken(plainText: string): string {
    if (!plainText) return '';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, this.getKey(), iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  public decryptToken(cipherText: string): string {
    if (!cipherText) return '';
    try {
      const [ivHex, encryptedHex] = cipherText.split(':');
      if (!ivHex || !encryptedHex) return cipherText; // return as-is if unencrypted fallback

      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, this.getKey(), iv);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      console.warn('Token decryption failed, returning raw fallback');
      return cipherText;
    }
  }
}

export const tokenEncryption = new TokenEncryptionService();
