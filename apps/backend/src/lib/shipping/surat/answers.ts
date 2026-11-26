import { ProviderError, providerText } from "../../errors"

/**
 * How Sürat Kargo's answers read (docs/entegrasyonlar/surat.md). Opening,
 * deleting and withdrawing a parcel answer free text with no result code:
 * only a sentence on the lists below counts as done, anything else as a
 * failure whose text staff read (made safe, at most 120 characters). A new
 * sentence Sürat is seen to send on success goes on its list, normalised
 * as `phraseOf` writes it. The lists hold what our sources give (the
 * owner's WooCommerce plugin, the community SDK); to complete with a real
 * account (doğrulanacak).
 */

export const SURAT_PROVIDER = "surat"

/** `GonderiyiKargoyaGonderYeni`: the parcel is registered. */
export const CREATED_PHRASES: readonly string[] = ["tamam", "başarılı", "işlem başarılı"]

/** `GonderiSil`: the parcel is deleted. */
export const DELETED_PHRASES: readonly string[] = [
  "tamam",
  "başarılı",
  "işlem başarılı",
  "silindi",
  "gönderi silindi",
  "kayıt silindi",
]

/** `GonderiGeriCek`: Sürat will bring the parcel back. */
export const WITHDRAWN_PHRASES: readonly string[] = [
  "tamam",
  "başarılı",
  "işlem başarılı",
  "geri çekildi",
  "gönderi geri çekildi",
]

/**
 * A sentence as the lists hold it: lower case the Turkish way, one space
 * between words, no punctuation at either end ("Tamam." is "tamam").
 */
export const phraseOf = (text: string): string =>
  text
    .toLocaleLowerCase("tr")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s.,;:!-]+|[\s.,;:!-]+$/g, "")

/** Whether Sürat's sentence is one of the known successes; never a guess from its words. */
export const saysDone = (text: string | null, phrases: readonly string[]): boolean =>
  text !== null && phrases.includes(phraseOf(text))

// What staff read of Sürat's sentence: made safe first (the account's values masked whole),
// then cut, so no cut leaves part of a password unmasked (security review 2026-11-26)
const MAX_SAID = 120

/**
 * Sürat's refusal, its own sentence kept for staff with the account's
 * values masked; `rejected` whatever it says (there is no code to keep).
 */
export const refused = (
  said: string | null,
  secrets: readonly (string | null | undefined)[] = [],
  code = "rejected"
) =>
  new ProviderError({
    provider: SURAT_PROVIDER,
    providerCode: code,
    retryable: false,
    providerMessage: said === null ? null : cutSafe(said, secrets),
    secrets,
  })

function cutSafe(said: string, secrets: readonly (string | null | undefined)[]): string | null {
  const safe = providerText(said, secrets)
  return safe === undefined ? null : Array.from(safe).slice(0, MAX_SAID).join("")
}

export const invalid = () =>
  new ProviderError({
    provider: SURAT_PROVIDER,
    providerCode: "invalid_response",
    retryable: false,
  })

// Sürat's words for a login it refuses, on a tracking answer (`errorMessage`): read first,
// so "cari kodu bulunamadı" is the login, not a parcel it does not know
const LOGIN_REFUSED = /şifre|sifre|parola|yetki|cari|kullanıcı adı|kullanici adi|giriş|giris/i
// Its words for a code it does not know: no verdict against the login
const NOT_FOUND = /bulunamad|kayıt yok|kayit yok|bulunmamaktadır|bulunmamaktadir/i

/** What a tracking refusal (`IsError`) says about the login; matched case-blind the Turkish way. */
export function trackingRefusal(message: string | null): "not_found" | "login" | "other" {
  const text = (message ?? "").toLocaleLowerCase("tr")
  if (LOGIN_REFUSED.test(text)) {
    return "login"
  }
  return NOT_FOUND.test(text) ? "not_found" : "other"
}
