import { z } from "@medusajs/framework/zod"
import { isValidTckn, isValidVkn } from "@qticaret/server-kit"
import { defineSection, isCleanText } from "./define"

/**
 * The shop's legal identity (F13.9, adr/0041 §3): what the law asks a web
 * shop to show (6563 sayılı Kanun) and its contracts quote. All public:
 * the storefront's footer, the `OnlineStore` structured data, the legal
 * texts' tokens.
 */
export interface LegalSettings {
  /** The company's registered title, or the sole trader's name. */
  company_title: string | null
  /** 16 digits; a sole trader may have none. */
  mersis: string | null
  tax_office: string | null
  /** VKN (10 digits) or, for a sole trader, TCKN (11). */
  tax_number: string | null
  address: string | null
  /** The registered e-mail (KEP) address. */
  kep: string | null
  /** The ETBİS registration number. */
  etbis: string | null
  /** The shop's social profiles (`sameAs`). */
  same_as: string[]
}

const clean = { message: "platform_settings.text_invalid" }
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => isCleanText(value), clean)
    .transform((value) => (value === "" ? null : value))
    .nullable()

const pattern = (re: RegExp, message: string) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, ""))
    .refine((value) => value === "" || re.test(value), { message })
    .transform((value) => (value === "" ? null : value))
    .nullable()

export const legalSection = defineSection<LegalSettings>(
  "legal",
  {
    company_title: text(200),
    mersis: pattern(/^\d{16}$/, "platform_settings.mersis_invalid"),
    tax_office: text(100),
    tax_number: z
      .string()
      .trim()
      .refine((value) => value === "" || isValidVkn(value) || isValidTckn(value), {
        message: "platform_settings.tax_number_invalid",
      })
      .transform((value) => (value === "" ? null : value))
      .nullable(),
    address: z
      .string()
      .trim()
      .max(500)
      .refine((value) => isCleanText(value, true), clean)
      .transform((value) => (value === "" ? null : value))
      .nullable(),
    kep: z
      .string()
      .trim()
      .toLowerCase()
      .refine((value) => value === "" || z.email().safeParse(value).success, {
        message: "platform_settings.kep_invalid",
      })
      .transform((value) => (value === "" ? null : value))
      .nullable(),
    etbis: pattern(/^[A-Za-z0-9-]{4,40}$/, "platform_settings.etbis_invalid"),
    same_as: z
      .array(
        z
          .string()
          .trim()
          .max(500)
          .regex(/^https:\/\/[^\s]+$/i, { message: "platform_settings.url_invalid" })
      )
      .max(10),
  },
  {
    company_title: null,
    mersis: null,
    tax_office: null,
    tax_number: null,
    address: null,
    kep: null,
    etbis: null,
    same_as: [],
  }
)
