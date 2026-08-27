import bcrypt from 'bcryptjs';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from((process.env.ENCRYPTION_KEY || 'a_32_byte_secret_key_for_aes256!').padEnd(32).slice(0, 32));

// Passwords (One-Way)
export const hashPassword = (pwd) => bcrypt.hash(pwd, 10);
export const comparePassword = (pwd, hash) => bcrypt.compare(pwd, hash);

// Tokens (Two-Way Encryption)
export const encryptToken = (text) => {
  if (!text) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
};

export const decryptToken = (encryptedData) => {
  if (!encryptedData) return null;
  const [ivHex, tagHex, textHex] = encryptedData.split(':');
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(textHex, 'hex')), decipher.final()]).toString('utf8');
};