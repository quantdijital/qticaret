/**
 * A shop's address on the platform (its slug), as the control plane takes
 * it (apps/control-plane `lib/tenants/slug.ts`): lower-case letters, digits
 * and single hyphens, 3 to 30, starting with a letter. The control plane
 * checks again and refuses reserved names.
 */
export const SLUG_PATTERN = /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){2,29}$/

const TURKISH: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" }

/** Suggested from the shop's name: "Bıçak Atölyesi" → "bicak-atolyesi". */
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
