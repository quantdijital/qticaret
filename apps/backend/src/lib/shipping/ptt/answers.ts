import { ProviderError, providerText } from "../../errors"

/**
 * How PTT's answers read (docs/entegrasyonlar/ptt.md). Upload and delete
 * answer a code (`hataKodu`; 1 is success, PTT's 2016 document) with a
 * sentence (`aciklama`); tracking a result code (`sonucKodu`, values not
 * documented) with its sentence. A refusal keeps PTT's sentence for staff,
 * the account's values masked, at most 120 characters.
 */

export const PTT_PROVIDER = "ptt"

/** PTT's code for success (`hataKodu`, `donguHataKodu`). */
export const PTT_OK = 1

const MAX_SAID = 120

function cutSafe(said: string, secrets: readonly (string | null | undefined)[]): string | null {
  const safe = providerText(said, secrets)
  return safe === undefined ? null : Array.from(safe).slice(0, MAX_SAID).join("")
}

/**
 * PTT's refusal: `ptt_<code>` when it gave one (`ptt_-5`), `rejected`
 * when it gave none; its sentence kept for staff, made safe.
 */
export const refused = (
  code: number | null,
  said: string | null,
  secrets: readonly (string | null | undefined)[] = [],
  providerCode = code === null ? "rejected" : `ptt_${String(code)}`
) =>
  new ProviderError({
    provider: PTT_PROVIDER,
    providerCode,
    retryable: false,
    providerMessage: said === null ? null : cutSafe(said, secrets),
    secrets,
  })

export const invalid = () =>
  new ProviderError({ provider: PTT_PROVIDER, providerCode: "invalid_response", retryable: false })

// PTT's words for an account it refuses: read first, so "müşteri bulunamadı" is the account,
// not a parcel it does not know (the words to confirm with a real account)
const LOGIN_REFUSED =
  /şifre|sifre|parola|yetki|kullanıcı|kullanici|müşteri|musteri|giriş|giris|login|password/i
// Its words for a barcode it does not know: no verdict against the account
const NOT_FOUND = /bulunamad|kayıt yok|kayit yok|bulunmamaktadır|bulunmamaktadir|yoktur/i

/** What a refusal's sentence says: about the account, a barcode PTT does not know, or else. */
export function refusalOf(said: string | null): "login" | "not_found" | "other" {
  const text = (said ?? "").toLocaleLowerCase("tr")
  if (LOGIN_REFUSED.test(text)) {
    return "login"
  }
  return NOT_FOUND.test(text) ? "not_found" : "other"
}
