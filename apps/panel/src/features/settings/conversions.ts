import { z } from "zod"
import type { AccountSave, Ga4Account, MetaAccount } from "@/features/settings/api/payments"
import { checkSecrets, nothingStored, typedSecrets } from "@/features/settings/payments"

/**
 * The conversion accounts' forms (F10.9): Meta's pixel id and its access
 * token (written once), GA4's measurement id and API secret, as the
 * server checks them.
 */

const SECRET = /^[\x21-\x7E]{8,512}$/
const PIXEL = /^\d{5,20}$/
const MEASUREMENT = /^G-[A-Z0-9]{4,20}$/
const TEST_CODE = /^[A-Za-z0-9]{1,40}$/

export interface MetaFormValues {
  pixelId: string
  testEventCode: string
  accessToken: string
}

export const metaFormValues = (account: MetaAccount | undefined): MetaFormValues => ({
  pixelId: account?.settings?.pixel_id ?? "",
  testEventCode: account?.settings?.test_event_code ?? "",
  accessToken: "",
})

export function metaFormSchema(account: MetaAccount | undefined) {
  return z
    .object({
      pixelId: z.string().trim().regex(PIXEL, "settings.marketing.conversions.meta.pixelIdHint"),
      testEventCode: z
        .string()
        .trim()
        .refine(
          (code) => code === "" || TEST_CODE.test(code),
          "settings.marketing.conversions.meta.testEventCodeHint"
        ),
      accessToken: z.string(),
    })
    .superRefine((values, ctx) => {
      checkSecrets(values, ["accessToken"], nothingStored(account), ctx, SECRET)
    })
}

export const metaSaveBody = (values: MetaFormValues): AccountSave => ({
  settings: {
    pixel_id: values.pixelId.trim(),
    ...(values.testEventCode.trim() ? { test_event_code: values.testEventCode.trim() } : {}),
  },
  ...typedSecrets({ access_token: values.accessToken }, ["access_token"]),
})

export interface Ga4FormValues {
  measurementId: string
  apiSecret: string
}

export const ga4FormValues = (account: Ga4Account | undefined): Ga4FormValues => ({
  measurementId: account?.settings?.measurement_id ?? "",
  apiSecret: "",
})

export function ga4FormSchema(account: Ga4Account | undefined) {
  return z
    .object({
      measurementId: z
        .string()
        .trim()
        .toUpperCase()
        .regex(MEASUREMENT, "settings.marketing.conversions.ga4.measurementIdHint"),
      apiSecret: z.string(),
    })
    .superRefine((values, ctx) => {
      checkSecrets(values, ["apiSecret"], nothingStored(account), ctx, SECRET)
    })
}

export const ga4SaveBody = (values: Ga4FormValues): AccountSave => ({
  settings: { measurement_id: values.measurementId.trim().toUpperCase() },
  ...typedSecrets({ api_secret: values.apiSecret }, ["api_secret"]),
})
