import * as crypto from 'crypto';

// URL-safe, unambiguous alphabet (no 0/O/1/l/I).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function generateCaseCode(length = 7): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function generateArchiveCode(length = 8): string {
  return `ARC-${generateCaseCode(length)}`;
}