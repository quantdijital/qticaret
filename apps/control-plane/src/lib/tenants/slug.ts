/**
 * A shop's slug (adr/0061 §2): its subdomain, its database (`qt_tenant_<slug>`,
 * §6.3) and its documents are named after it, so it is fixed once made and
 * kept to what all three accept: lower-case ASCII letters, digits and single
 * hyphens, 3 to 30 characters, starting with a letter. Names the platform
 * itself answers on, or that read as the platform, are reserved.
 */

export const SLUG_PATTERN = /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){2,29}$/

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "aapanel",
  "about",
  "account",
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "autoconfig",
  "autodiscover",
  "billing",
  "blog",
  "cdn",
  "control",
  "control-plane",
  "cpanel",
  "dashboard",
  "demo",
  "destek",
  "dev",
  "docs",
  "email",
  "fatura",
  "ftp",
  "giris",
  "help",
  "hesap",
  "imap",
  "localhost",
  "login",
  "magaza",
  "mail",
  "media",
  "mta-sts",
  "ns1",
  "ns2",
  "ns3",
  "ns4",
  "odeme",
  "panel",
  "platform",
  "pop",
  "pop3",
  "postgres",
  "qticaret",
  "quant",
  "quantticaret",
  "redis",
  "root",
  "secure",
  "shop",
  "smtp",
  "smtp-relay",
  "staging",
  "static",
  "status",
  "store",
  "support",
  "system",
  "tenant",
  "test",
  "ust-panel",
  "webmail",
  "whm",
  "wpad",
  "www",
  "www2",
  "yardim",
  "yonetim",
])

export type SlugProblem = "cp.slug_invalid" | "cp.slug_reserved"

/** Why a slug cannot be used, or null when it can (taken or not is the database's to say). */
export function slugProblem(slug: string): SlugProblem | null {
  if (!SLUG_PATTERN.test(slug)) {
    return "cp.slug_invalid"
  }
  return RESERVED_SLUGS.has(slug) ? "cp.slug_reserved" : null
}

const TURKISH: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" }

/** A slug suggested from a shop's name (`Bıçak Atölyesi` → `bicak-atolyesi`); the panel does the same. */
export function slugFromName(name: string): string {
  return name
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (letter) => TURKISH[letter] ?? letter)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^[0-9-]+/, "")
    .slice(0, 30)
    .replace(/-+$/, "")
}
