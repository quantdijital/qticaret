import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto"

/**
 * A role password as Postgres stores it under SCRAM-SHA-256 (RFC 5802,
 * RFC 7677; Postgres `password_encryption = scram-sha-256`), made here so
 * the plaintext never reaches the server (C10 review L2): `CREATE ROLE …
 * PASSWORD 'SCRAM-SHA-256$<iterations>:<salt>$<StoredKey>:<ServerKey>'`.
 * Postgres keeps a value already in this form as it is. Our passwords are
 * ASCII (hex), so SASLprep leaves them unchanged.
 */

export const SCRAM_ITERATIONS = 4096

const hmac = (key: Buffer, text: string) => createHmac("sha256", key).update(text).digest()

export function scramKeys(password: string, salt: Buffer, iterations: number = SCRAM_ITERATIONS) {
  const salted = pbkdf2Sync(password, salt, iterations, 32, "sha256")
  const clientKey = hmac(salted, "Client Key")
  return {
    storedKey: createHash("sha256").update(clientKey).digest(),
    serverKey: hmac(salted, "Server Key"),
  }
}

/** The verifier for `password`; a fresh 16-byte salt unless one is given (tests). */
export function scramVerifier(
  password: string,
  salt: Buffer = randomBytes(16),
  iterations: number = SCRAM_ITERATIONS
): string {
  const { storedKey, serverKey } = scramKeys(password, salt, iterations)
  return (
    `SCRAM-SHA-256$${String(iterations)}:${salt.toString("base64")}` +
    `$${storedKey.toString("base64")}:${serverKey.toString("base64")}`
  )
}

/** What a verifier may look like before it goes into a statement. */
export const SCRAM_VERIFIER =
  /^SCRAM-SHA-256\$\d{4,7}:[A-Za-z0-9+/]+=*\$[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/
