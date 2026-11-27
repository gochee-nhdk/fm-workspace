const crypto = require('crypto');

const DEV_FALLBACK_SECRET = 'dev_secret_farmers_market_local_development_only_2026';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;
  if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
    if (!process.env.LOCAL_DEV) {
      throw new Error('[Security] JWT_SECRET environment variable is required in production.');
    }
  }
  return DEV_FALLBACK_SECRET;
}

function getEncryptionKeyBytes() {
  const raw =
    process.env.ENCRYPTION_KEY?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    DEV_FALLBACK_SECRET;
  return crypto.createHash('sha256').update(raw).digest();
}

function encryptSecret(plaintext) {
  if (plaintext === null || plaintext === undefined) return '';
  const str = String(plaintext);
  if (!str) return '';
  const key = getEncryptionKeyBytes();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptSecret(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') return '';
  if (!ciphertext.startsWith('enc:v1:')) return ciphertext;
  const parts = ciphertext.split(':');
  if (parts.length !== 5) return '';
  const iv = Buffer.from(parts[2], 'base64');
  const tag = Buffer.from(parts[3], 'base64');
  const data = Buffer.from(parts[4], 'base64');
  const key = getEncryptionKeyBytes();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hashHex] = parts;
  const expectedBuf = Buffer.from(hashHex, 'hex');
  const actualBuf = crypto.scryptSync(password, salt, 64);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

// Constant-time dummy check to mitigate timing-based user enumeration
const DUMMY_SCRYPT_HASH = hashPassword('dummy_constant_time_password_2026');
function dummyPasswordCheck(password) {
  try {
    verifyPassword(password || 'dummy', DUMMY_SCRYPT_HASH);
  } catch (_) {}
}

function signJwt(payload, expiresInSeconds = 30 * 24 * 60 * 60) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      jti: crypto.randomUUID(),
      iat: nowSec,
      exp: nowSec + expiresInSeconds,
    })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getJwtSecret())
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Thiếu token xác thực' };
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Cấu trúc JWT token không hợp lệ' };
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getJwtSecret())
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  const sigBuf = Buffer.from(signatureB64);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: 'Chữ ký JWT không hợp lệ hoặc đã bị can thiệp' };
  }

  try {
    let base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return { valid: false, error: 'Phiên đăng nhập đã hết hạn' };
    }
    return { valid: true, user: payload, rawToken: token };
  } catch (_) {
    return { valid: false, error: 'Nội dung payload token không hợp lệ' };
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token).trim()).digest('hex');
}

function maskSecret(secret, prefixLen = 6, suffixLen = 4) {
  if (!secret || typeof secret !== 'string') return '';
  if (secret.length <= prefixLen + suffixLen) {
    return '••••••••';
  }
  return `${secret.slice(0, prefixLen)}••••••••${secret.slice(-suffixLen)}`;
}

module.exports = {
  getJwtSecret,
  encryptSecret,
  decryptSecret,
  hashPassword,
  verifyPassword,
  dummyPasswordCheck,
  signJwt,
  verifyJwt,
  hashToken,
  maskSecret,
};
