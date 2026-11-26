/** A login Sürat gives with the contract. */
export interface SuratLogin {
  username: string
  password: string
}

/** The shop's Sürat Kargo contract as the client takes it (docs/entegrasyonlar/surat.md). */
export interface SuratCredentials {
  /** Opens and withdraws parcels (`KullaniciAdi`, `Sifre`). */
  shipping: SuratLogin
  /**
   * Tracks, labels and deletes them: the cari kodu and its web password
   * (`CariKodu`, `WebPassword`). Sürat may give one pair for both: then the
   * shipping login stands in (to confirm with a real account).
   */
  tracking: SuratLogin
}

/**
 * The account as the panel stored it (adr/0027): every part sealed. Null
 * when the shipping login is missing; the cari pair counts only with both
 * its parts. Sürat has no test service: no mode to keep (a developer's
 * machine points the client at the fake, `SURAT_BASE_URL`).
 */
export function suratCredentialsOf(
  account: { settings: Record<string, unknown>; secrets: Record<string, string> } | null
): SuratCredentials | null {
  const username = account?.secrets["username"]
  const password = account?.secrets["password"]
  if (!username || !password) {
    return null
  }
  const cariCode = account.secrets["cari_code"]
  const webPassword = account.secrets["web_password"]
  const shipping = { username, password }
  return {
    shipping,
    tracking: cariCode && webPassword ? { username: cariCode, password: webPassword } : shipping,
  }
}

/** Every value of the account: masked wherever Sürat quotes one back. */
export const suratSecrets = (credentials: SuratCredentials): string[] => [
  credentials.shipping.username,
  credentials.shipping.password,
  credentials.tracking.username,
  credentials.tracking.password,
]
