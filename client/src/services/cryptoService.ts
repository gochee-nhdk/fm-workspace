/**
 * Zero-Knowledge Military-Grade Cryptography Service
 * Standard: AES-GCM 256-bit + PBKDF2 (100,000 iterations, SHA-256)
 * Built with standard Web Crypto API (SubtleCrypto) — zero external dependencies, ultra-fast.
 *
 * Prevents unauthorized reading or tampering of exported backups & synced payloads.
 */

export interface EncryptedPackage {
  algorithm: 'AES-GCM-256';
  kdf: 'PBKDF2';
  iterations: number;
  salt: string; // Base64
  iv: string;   // Base64
  ciphertext: string; // Base64
}

const KDF_ITERATIONS = 100000;

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export const cryptoService = {
  /**
   * Encrypt a plaintext string using a user password.
   * Returns a structured EncryptedPackage with Salt and IV.
   */
  async encrypt(plaintext: string, passphrase: string): Promise<EncryptedPackage> {
    if (!passphrase || passphrase.length < 1) {
      throw new Error('Mật khẩu mã hóa không được để trống.');
    }

    const enc = new TextEncoder();
    const data = enc.encode(plaintext);

    // 1. Generate 16 bytes cryptographically secure random Salt
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // 2. Import raw passphrase
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // 3. Derive 256-bit AES-GCM Key using PBKDF2
    const aesKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: KDF_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    // 4. Generate 12 bytes random IV for AES-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // 5. Encrypt data
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      aesKey,
      data
    );

    return {
      algorithm: 'AES-GCM-256',
      kdf: 'PBKDF2',
      iterations: KDF_ITERATIONS,
      salt: bufferToBase64(salt),
      iv: bufferToBase64(iv),
      ciphertext: bufferToBase64(encrypted),
    };
  },

  /**
   * Decrypt an EncryptedPackage using the passphrase.
   * Throws an error if the passphrase is incorrect or ciphertext has been altered.
   */
  async decrypt(pkg: EncryptedPackage, passphrase: string): Promise<string> {
    if (!passphrase || passphrase.length < 1) {
      throw new Error('Vui lòng nhập mật khẩu giải mã.');
    }

    const enc = new TextEncoder();
    const salt = base64ToBuffer(pkg.salt);
    const iv = base64ToBuffer(pkg.iv);
    const ciphertext = base64ToBuffer(pkg.ciphertext);

    // 1. Import raw passphrase
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // 2. Derive AES Key
    const aesKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: pkg.iterations || KDF_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // 3. Decrypt data (will reject if wrong password or tampered data)
    try {
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource,
        },
        aesKey,
        ciphertext as BufferSource
      );

      const dec = new TextDecoder();
      return dec.decode(decrypted);
    } catch (_) {
      throw new Error('Mật khẩu giải mã không chính xác hoặc dữ liệu sao lưu đã bị thay đổi!');
    }
  },

  /**
   * Deterministic SHA-256 Hex Digest
   */
  async sha256(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  },
};
