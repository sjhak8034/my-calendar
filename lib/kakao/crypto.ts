import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// 카카오 토큰을 DB에 두기 위한 AES-256-GCM 암호화. 저장 형식: base64url(iv).base64url(tag).base64url(암호문)
// userId를 AAD(추가 인증 데이터)로 묶어, 다른 사용자의 행에 옮겨 붙인 값은 복호화되지 않게 한다.

const IV_BYTES = 12;

export function encryptToken(plain: string, userId: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(userId));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64url")).join(".");
}

// 형식이 틀렸거나 키·사용자가 다르거나 값이 변조됐으면 null.
export function decryptToken(stored: string, userId: string, key: Buffer): string | null {
  const parts = stored.split(".");
  if (parts.length !== 3) return null;
  try {
    const [iv, tag, body] = parts.map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(userId));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
