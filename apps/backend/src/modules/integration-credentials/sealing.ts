import {
  EnvelopeError,
  canonicalJsonDeep,
  isSerializedEnvelope,
  openEnvelopeText,
  openSecret,
  parseEnvelope,
  rewrapEnvelope,
  sealEnvelope,
  serializeEnvelope,
} from "@qticaret/server-kit"
import type { Envelope, EnvelopeContext } from "@qticaret/server-kit"
import type { CredentialKeyring } from "../../lib/integrations/credential-keys"
import { contextOf } from "./rows"

/**
 * How an account's secrets are sealed (adr/0061 §4.4, Ek C17): one
 * envelope per row, its own random data key wrapped under the current
 * credentials KEK, stored as one text (`qtenv1.<kek id>.<wrapped data
 * key>.<iv|tag|ciphertext>`) with the KEK id beside it in `key_id`. The
 * associated data is the provider and its settings, as adr/0027 bound
 * them: a blob copied to another provider's row, or settings changed in
 * the database behind the panel's back, open nowhere.
 *
 * Rows sealed before (adr/0027's box straight under the key, `key_id` the
 * key's fingerprint) are still read and are upgraded as they are read.
 * Nothing here logs, and no error carries a secret.
 *
 * The settings are bound in code-unit order at every depth
 * (`canonicalJsonDeep`), never the locale's order (review L4): the same
 * bytes on every machine, whatever its language. adr/0027's context
 * (`contextOf`, locale order) stays only to open the old rows.
 *
 * The shop is not bound (review I5, decision): each shop has its own KEK,
 * so another shop's blob opens nowhere; binding `TENANT_ID` now would make
 * every envelope of a shop unreadable the day it goes from unmanaged to
 * managed. The Transit switch (F16) brings a key per shop or the tenant in
 * the associated data.
 */

export const credentialContext = (
  provider: string,
  settings: Record<string, unknown>
): EnvelopeContext => ({
  record: "integration_credential",
  provider,
  settings: canonicalJsonDeep(settings),
})

/** The two columns that hold a sealed account. */
export interface Sealed {
  secret_ciphertext: string
  key_id: string
}

export interface SealedRow extends Sealed {
  provider: string
  settings: Record<string, unknown>
}

export type Opened =
  | {
      ok: true
      secrets: Record<string, string>
      /** Sealed the old way or under an older KEK: worth writing again. */
      stale: boolean
    }
  /**
   * `kek_missing`: sealed under a key this process does not hold (removed
   * before its rewrap, or another shop's); `unreadable`: damaged, moved or
   * its settings changed.
   */
  | { ok: false; reason: "kek_missing" | "unreadable"; key_id: string }

export async function sealCredentials(
  keyring: CredentialKeyring,
  provider: string,
  settings: Record<string, unknown>,
  secrets: Record<string, string>
): Promise<Sealed> {
  const envelope = await sealEnvelope(
    JSON.stringify(secrets),
    credentialContext(provider, settings),
    keyring.wrapper
  )
  return { secret_ciphertext: serializeEnvelope(envelope), key_id: envelope.kekId }
}

const parsed = (text: string): Envelope | null => {
  try {
    return parseEnvelope(text)
  } catch {
    return null
  }
}

const secretsOf = (json: string) => JSON.parse(json) as Record<string, string>

/** A stored row's secrets, or why they cannot be had. */
export async function openCredentials(keyring: CredentialKeyring, row: SealedRow): Promise<Opened> {
  const unreadable = { ok: false, reason: "unreadable", key_id: row.key_id } as const
  if (isSerializedEnvelope(row.secret_ciphertext)) {
    const envelope = parsed(row.secret_ciphertext)
    // The column and the blob must name the same KEK: an edited row is not trusted
    if (envelope?.kekId !== row.key_id) {
      return unreadable
    }
    if (!keyring.wrapper.canUnwrap(envelope.kekId)) {
      return { ok: false, reason: "kek_missing", key_id: row.key_id }
    }
    try {
      const json = await openEnvelopeText(
        envelope,
        credentialContext(row.provider, row.settings),
        keyring.wrapper
      )
      return { ok: true, secrets: secretsOf(json), stale: envelope.kekId !== keyring.wrapper.kekId }
    } catch {
      return unreadable
    }
  }
  const legacy = keyring.legacy.get(row.key_id)
  if (!legacy) {
    return { ok: false, reason: "kek_missing", key_id: row.key_id }
  }
  try {
    const json = openSecret(
      row.secret_ciphertext,
      legacy.key,
      contextOf(row.provider, row.settings)
    )
    return { ok: true, secrets: secretsOf(json), stale: true }
  } catch {
    return unreadable
  }
}

/**
 * A draft's secrets: an envelope under any configured KEK, or (a draft made
 * before the upgrade and still in a workflow) the old box under any
 * configured key. Null when nothing opens it.
 */
export async function openSealedDraft(
  keyring: CredentialKeyring,
  provider: string,
  settings: Record<string, unknown>,
  text: string
): Promise<Record<string, string> | null> {
  const envelope = isSerializedEnvelope(text) ? parsed(text) : null
  const candidates = envelope ? [envelope.kekId] : [...keyring.legacy.keys()]
  for (const keyId of candidates) {
    const opened = await openCredentials(keyring, {
      provider,
      settings,
      secret_ciphertext: text,
      key_id: keyId,
    })
    if (opened.ok) {
      return opened.secrets
    }
  }
  return null
}

/**
 * The row sealed as new rows are: an envelope under an older KEK has its
 * data key rewrapped (the data is not encrypted again); an old-format row
 * is sealed afresh from its secrets. `secrets` are the row's, just opened.
 * A text that looks like an envelope but does not parse is refused, never
 * sealed afresh (review I1): the rewrap passes no secrets for envelopes.
 */
export async function upgradedSeal(
  keyring: CredentialKeyring,
  row: SealedRow,
  secrets: Record<string, string>
): Promise<Sealed> {
  if (!isSerializedEnvelope(row.secret_ciphertext)) {
    return sealCredentials(keyring, row.provider, row.settings, secrets)
  }
  const envelope = parsed(row.secret_ciphertext)
  if (!envelope) {
    throw new EnvelopeError("envelope.malformed")
  }
  const moved = await rewrapEnvelope(
    envelope,
    credentialContext(row.provider, row.settings),
    keyring.wrapper
  )
  return { secret_ciphertext: serializeEnvelope(moved.envelope), key_id: moved.envelope.kekId }
}

/**
 * A copy kept for a compensation, as it is put back (review I4): sealed
 * the old way or under an older KEK, it is sealed as new rows are, so an
 * undo never brings back a key the rewrap already moved the row away from.
 * A copy no configured key opens goes back as it was.
 */
export async function resealedForRestore(
  keyring: CredentialKeyring | null,
  row: SealedRow
): Promise<Sealed> {
  const sealed = { secret_ciphertext: row.secret_ciphertext, key_id: row.key_id }
  if (!keyring) {
    return sealed
  }
  const opened = await openCredentials(keyring, row)
  return opened.ok && opened.stale ? upgradedSeal(keyring, row, opened.secrets) : sealed
}
