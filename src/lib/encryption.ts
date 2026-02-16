// AES-256-GCM Encryption using Web Crypto API

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

export async function generateEncryptionKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function exportKey(key: CryptoKey): Promise<JsonWebKey> {
  return await crypto.subtle.exportKey('jwk', key);
}

export async function importKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptMessage(message: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );
  
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv))
  };
}

export async function decryptMessage(ciphertext: string, iv: string, key: CryptoKey): Promise<string> {
  try {
    const encryptedData = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const ivData = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
    
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: ivData },
      key,
      encryptedData
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch {
    return '[Decryption failed]';
  }
}

export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

// Local storage encryption
export function getOrCreateSalt(): Uint8Array {
  const stored = localStorage.getItem('ourdm_salt');
  if (stored) {
    return Uint8Array.from(atob(stored), c => c.charCodeAt(0));
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem('ourdm_salt', btoa(String.fromCharCode(...salt)));
  return salt;
}

export async function getLocalEncryptionKey(pin?: string): Promise<CryptoKey> {
  const storedKey = localStorage.getItem('ourdm_encryption_key');
  
  if (storedKey && !pin) {
    return await importKey(JSON.parse(storedKey));
  }
  
  if (pin) {
    const salt = getOrCreateSalt();
    return await deriveKeyFromPassword(pin, salt);
  }
  
  const key = await generateEncryptionKey();
  const exported = await exportKey(key);
  localStorage.setItem('ourdm_encryption_key', JSON.stringify(exported));
  return key;
}
