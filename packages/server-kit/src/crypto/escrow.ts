import type * as Age from "age-encryption" with { "resolution-mode": "import" }

// An ES module loaded with require(esm) (Node ≥ 22.12): synchronous, and
// accepted by the Medusa apps' `module: Node16`, which refuses a static
// import of an ES module from CommonJS (Jest compiles it, jest.config.js)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Encrypter, armor } = require("age-encryption") as typeof Age

/**
 * Escrow (adr/0061 §4.3): a shop's runtime secrets sealed to the offline
 * `age` recipients the backups use (infra/backup), so the shop can be
 * brought back from a backup with the owner's offline key. Only public
 * recipients (`age1…`) are ever configured: whoever holds this code or its
 * database cannot open what it seals. `age-encryption` is the format's
 * reference TypeScript implementation (by age's author), called in
 * process: no shell, no binary (Ek C8). Its own subpath
 * (`@qticaret/server-kit/escrow`), not the barrel: the package is ES
 * modules only, and the shop backend never needs it.
 */

export type EscrowErrorCode = "escrow.invalid_recipient" | "escrow.identity_given"

/** Never carries a recipient's value or plaintext; `code` says what went wrong. */
export class EscrowError extends Error {
  override readonly name = "EscrowError"
  readonly code: EscrowErrorCode

  constructor(code: EscrowErrorCode, message: string = code) {
    super(message)
    this.code = code
  }
}

// X25519 (`age1` + 58) and the post-quantum hybrid (`age1pq1…`, longer)
const RECIPIENT = /^age1[0-9a-z]{58,4000}$/
const MAX_RECIPIENTS = 10

/**
 * Comma- or whitespace-separated `age1…` public keys. An identity
 * (`AGE-SECRET-KEY-…`) is refused outright: the private half never belongs
 * here. Each one is checked by the library itself (bech32 checksum, length).
 * Messages name the variable, never a value.
 */
export function parseAgeRecipients(value: string, name: string): string[] {
  if (/AGE-SECRET-KEY-/i.test(value)) {
    throw new EscrowError(
      "escrow.identity_given",
      `${name} must list public recipients only, never an identity`
    )
  }
  const parts = value
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter((part) => part !== "")
  if (parts.length === 0 || parts.length > MAX_RECIPIENTS) {
    throw new EscrowError(
      "escrow.invalid_recipient",
      `${name} must list 1 to ${String(MAX_RECIPIENTS)} age recipients`
    )
  }
  for (const part of parts) {
    if (!RECIPIENT.test(part)) {
      throw new EscrowError("escrow.invalid_recipient", `${name} must list age1… recipients`)
    }
    try {
      new Encrypter().addRecipient(part)
    } catch {
      throw new EscrowError("escrow.invalid_recipient", `${name} lists an invalid age recipient`)
    }
  }
  if (new Set(parts).size !== parts.length) {
    throw new EscrowError("escrow.invalid_recipient", `${name} lists the same recipient twice`)
  }
  return parts
}

/**
 * `plaintext` sealed to every recipient, as an armored age file
 * (`-----BEGIN AGE ENCRYPTED FILE-----`): any one of their identities
 * opens it, nothing else does.
 */
export async function sealToAgeRecipients(
  plaintext: string | Uint8Array,
  recipients: readonly string[]
): Promise<string> {
  if (recipients.length === 0) {
    throw new EscrowError("escrow.invalid_recipient", "at least one age recipient is required")
  }
  const encrypter = new Encrypter()
  for (const recipient of recipients) {
    encrypter.addRecipient(recipient)
  }
  return armor.encode(await encrypter.encrypt(plaintext))
}
