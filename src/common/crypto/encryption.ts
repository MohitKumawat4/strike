import crypto from "node:crypto";
import { getServerEnv } from "@/config/server-env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM
const TAG_LENGTH = 16; // 128-bit authentication tag

/**
 * Derives a 32-byte cryptographic key from the configured ENCRYPTION_KEY.
 */
function getEncryptionKey(): Buffer {
  const env = getServerEnv();
  // Hash the encryption key with SHA-256 to guarantee exactly 32 bytes
  return crypto.createHash("sha256").update(env.ENCRYPTION_KEY).digest();
}

/**
 * Encrypts a plaintext string (e.g. OAuth refresh token) using AES-256-GCM.
 * Returns formatted string: `ivHex:tagHex:cipherTextHex`
 */
export function encryptToken(plainText: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");
  const ivHex = iv.toString("hex");

  return `${ivHex}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an encrypted token string produced by encryptToken().
 */
export function decryptToken(encryptedPayload: string): string {
  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format. Expected iv:tag:data");
  }

  const [ivHex, tagHex, dataHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(dataHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
