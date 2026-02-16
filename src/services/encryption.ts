// ============================================
// OURDM v3.0.0 - End-to-End Encryption Service
// AES-256-GCM Encryption
// ============================================

// Encryption key stored in localStorage
const ENCRYPTION_KEY_NAME = 'ourdm_encryption_key';

// Generate a new encryption key
export async function generateEncryptionKey(): Promise<CryptoKey> {
  const key = await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
  
  // Export and store the key
  const exportedKey = await crypto.subtle.exportKey('jwk', key);
  localStorage.setItem(ENCRYPTION_KEY_NAME, JSON.stringify(exportedKey));
  
  return key;
}

// Get or create encryption key
export async function getEncryptionKey(): Promise<CryptoKey> {
  const storedKey = localStorage.getItem(ENCRYPTION_KEY_NAME);
  
  if (storedKey) {
    try {
      const jwk = JSON.parse(storedKey);
      return await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('Failed to import stored key, generating new one:', error);
    }
  }
  
  return generateEncryptionKey();
}

// Encrypt a message
export async function encryptMessage(plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await getEncryptionKey();
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encode plaintext to bytes
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Encrypt
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    data
  );
  
  // Convert to base64 for storage
  const ciphertext = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
  const ivBase64 = btoa(String.fromCharCode(...iv));
  
  return { ciphertext, iv: ivBase64 };
}

// Decrypt a message
export async function decryptMessage(ciphertext: string, ivBase64: string): Promise<string> {
  const key = await getEncryptionKey();
  
  // Convert from base64
  const encryptedBytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));
  
  // Decrypt
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encryptedBytes
  );
  
  // Decode to string
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

// Export encryption key for backup
export async function exportEncryptionKey(): Promise<string> {
  const key = await getEncryptionKey();
  const exported = await crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(exported);
}

// Import encryption key from backup
export async function importEncryptionKey(keyJson: string): Promise<void> {
  const jwk = JSON.parse(keyJson);
  
  // Validate by importing
  await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  // Store
  localStorage.setItem(ENCRYPTION_KEY_NAME, keyJson);
}

// Hash password for local storage (not for server auth)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

// Generate a random PIN hash
export async function hashPin(pin: string): Promise<string> {
  return hashPassword(pin + '_ourdm_salt');
}

// Verify PIN
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const hash = await hashPin(pin);
  return hash === storedHash;
}
