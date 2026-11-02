import type { TFunction } from "i18next"
import type { FieldError } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { useSaveSection } from "@/features/settings/api/sections"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { unknownShopTokens } from "@/features/settings/shop-tokens"
import { errorText } from "@/lib/errors"

/**
 * The storefront's frame as the server takes it (backend
 * `platform-settings/sections/storefront.ts`, docs/19 §4): the same limits
 * and the same link and phone rules, so the shop sees a mistake before it
 * saves instead of after.
 */
export const STOREFRONT_LIMITS = {
  announcements: 5,
  announcementLength: 120,
  topLinks: 8,
  linkLabelLength: 60,
  footerGroups: 4,
  groupTitleLength: 40,
  groupLinks: 10,
  badges: 4,
  badgeTitleLength: 40,
  badgeTextLength: 80,
  menuItems: 12,
  menuLabelLength: 40,
  menuChildren: 20,
  heroEyebrowLength: 40,
  heroHeadingLength: 90,
  heroTextLength: 240,
  heroLinks: 2,
  colorSwatches: 100,
  swatchLabelLength: 40,
} as const

const E = "settings.storefront.errors"
const MAX_PATH_LENGTH = 512
const MAX_URL_LENGTH = 2048
const MAX_PHONE_LENGTH = 32
// An optional country prefix, then ten digits (backend lib/tr/phone.ts)
const TR_PHONE = /^(?:\+90|0090|90|0)?[2-58]\d{9}$/
const PHONE_SEPARATORS = /[\s().-]/g
// `#rrggbb`, lower case: the server lower-cases what it is given
const HEX_COLOR = /^#[0-9a-f]{6}$/

/** No control characters and no lone surrogates (backend lib/security/text.ts). */
export function isCleanText(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    const control = code < 0x20 || (code >= 0x7f && code <= 0x9f)
    const loneSurrogate = code >= 0xd800 && code <= 0xdfff
    if (control || loneSurrogate) {
      return false
    }
  }
  return true
}

const isShopPath = (value: string): boolean =>
  value.length <= MAX_PATH_LENGTH &&
  value.startsWith("/") &&
  !value.startsWith("//") &&
  !value.includes("\\") &&
  !/\s/.test(value)

/** An absolute https address without credentials (backend lib/security/https-url.ts). */
export const isHttpsUrl = (value: string): boolean => {
  if (value.length > MAX_URL_LENGTH || !value.startsWith("https://")) {
    return false
  }
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.username === "" && url.password === ""
  } catch {
    return false
  }
}

/** A page of the shop (`/hakkimizda`) or an https address: never a script, another scheme or a bare host. */
export const isStorefrontHref = (value: string): boolean =>
  isCleanText(value) && (isShopPath(value) || isHttpsUrl(value))

/** A Turkish number in one of its usual spellings; the server stores it as E.164. */
export const isTrPhone = (value: string): boolean =>
  TR_PHONE.test(value.replace(PHONE_SEPARATORS, ""))

const E164_TR = /^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/

/** `+905321234567` as a Turkish reader writes it (`0532 123 45 67`); another value as it is. */
export function displayTrPhone(e164: string): string {
  const parts = E164_TR.exec(e164)
  return parts ? `0${parts.slice(1).join(" ")}` : e164
}

/** A line that must be written, `max` characters at most; `tooLong` reads `max` when shown. */
export const lineSchema = (max: number) =>
  z
    .string()
    .trim()
    .min(1, `${E}.required`)
    .max(max, `${E}.tooLong`)
    .refine(isCleanText, `${E}.textInvalid`)

/**
 * A text the storefront fills with the shop's details (adr/0048): the
 * announcements, the trust badges, the home page's opening. A `{name}`
 * that is no detail is refused, as the server refuses it.
 */
export const knownTokens = [
  (value: string) => unknownShopTokens(value).length === 0,
  `${E}.tokenUnknown`,
] as const

/** A line that may stay empty (saved as none). */
export const optionalLineSchema = (max: number) =>
  z.string().trim().max(max, `${E}.tooLong`).refine(isCleanText, `${E}.textInvalid`)

/**
 * Where the contact form shows (adr/0047): a shop page other than the home
 * page, lower-cased as the server stores it; turned off, the path is not read.
 */
export const contactFormSchema = z
  .object({ enabled: z.boolean(), path: z.string().trim().toLowerCase() })
  .refine(
    ({ enabled, path }) => !enabled || (isCleanText(path) && isShopPath(path) && path !== "/"),
    { path: ["path"], message: `${E}.pathInvalid` }
  )

/** `#rrggbb` as the server keeps it. */
export const isHexColor = (value: string): boolean => HEX_COLOR.test(value)

export const hrefSchema = z
  .string()
  .trim()
  .min(1, `${E}.required`)
  .refine(isStorefrontHref, `${E}.hrefInvalid`)

export const linkSchema = z.object({
  label: lineSchema(STOREFRONT_LIMITS.linkLabelLength),
  href: hrefSchema,
})
export type LinkValues = z.infer<typeof linkSchema>

export const phoneSchema = z
  .string()
  .trim()
  .max(MAX_PHONE_LENGTH, `${E}.phoneInvalid`)
  .refine((value) => value === "" || isTrPhone(value), `${E}.phoneInvalid`)

/** A colour as `#rrggbb` in any case, or empty (saved as none: the theme's own). */
export const colorSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value) => value === "" || isHexColor(value), `${E}.colorInvalid`)

/**
 * The shop's colour names (F18 D5): each a name and a `#rrggbb` code, lower
 * case as the server keeps it; a name written twice, in any Turkish case,
 * is refused on its later row as the server refuses the list.
 */
export const colorSwatchesSchema = z
  .array(
    z.object({
      label: lineSchema(STOREFRONT_LIMITS.swatchLabelLength),
      hex: z.string().trim().toLowerCase().refine(isHexColor, `${E}.colorInvalid`),
    })
  )
  .max(STOREFRONT_LIMITS.colorSwatches)
  .superRefine((swatches, ctx) => {
    const seen = new Set<string>()
    swatches.forEach(({ label }, index) => {
      const name = label.toLocaleLowerCase("tr")
      if (name !== "" && seen.has(name)) {
        ctx.addIssue({ code: "custom", path: [index, "label"], message: `${E}.colorDuplicate` })
      }
      seen.add(name)
    })
  })

/** A field's error as a sentence; `max` fills the length limit's. */
export const errorLine = (
  t: TFunction,
  error: FieldError | undefined,
  max?: number
): string | undefined => (error?.message ? t(error.message, { max }) : undefined)

/**
 * Saves one card's field of the storefront section; `onSaved` gets what the
 * server stored (trimmed, the phone in E.164) so the card shows it as saved.
 */
export function useSaveStorefront() {
  const { t } = useTranslation()
  const mutation = useSaveSection<StorefrontSettings>("storefront")
  return {
    saving: mutation.isPending,
    save: (body: Partial<StorefrontSettings>, onSaved: (saved: StorefrontSettings) => void) => {
      mutation.mutate(body, {
        onSuccess: (result) => {
          onSaved(result.values)
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      })
    },
  }
}
