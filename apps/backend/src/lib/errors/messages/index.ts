import { SERVER_ERROR_MESSAGES_EN } from "./en"
import { SERVER_ERROR_MESSAGES_TR } from "./tr"

export { SERVER_ERROR_MESSAGES_EN, SERVER_ERROR_MESSAGES_TR }
export { providerFailureSentence, providerName } from "./provider"
export type { ProviderFailure } from "./provider"

export type MessageLocale = "tr" | "en"

const MESSAGES: Readonly<Record<MessageLocale, Readonly<Record<string, string>>>> = {
  tr: SERVER_ERROR_MESSAGES_TR,
  en: SERVER_ERROR_MESSAGES_EN,
}

// For a key without a sentence yet: still readable, and support can find it
const GENERIC: Readonly<Record<MessageLocale, (key: string) => string>> = {
  tr: (key) => `İşlem tamamlanamadı (hata kodu: ${key}).`,
  en: (key) => `The action could not be completed (error code: ${key}).`,
}

// `{{tokens}}` in a sentence; a single `{mağaza_unvanı}` is the sentence's own text
const PLACEHOLDER = /\{\{([a-z_]+)\}\}/g

/**
 * The sentence for an API error key (`catalog.handle_invalid`), with what
 * the error named (`values`) in its `{{name}}`s; a name without a value
 * leaves nothing behind.
 */
export function serverErrorMessage(
  key: string,
  locale: MessageLocale = "tr",
  values: Readonly<Record<string, string>> = {}
): string {
  const messages = MESSAGES[locale]
  const sentence = Object.hasOwn(messages, key)
    ? (messages[key] ?? GENERIC[locale](key))
    : GENERIC[locale](key)
  return sentence.replace(PLACEHOLDER, (_, name: string) =>
    Object.hasOwn(values, name) ? (values[name] ?? "") : ""
  )
}

// A plan limit as its refusal names it (adr/0061 Ek C14); megabytes carry their unit
const LIMIT_NAMES: Readonly<Record<MessageLocale, Readonly<Record<string, string>>>> = {
  tr: {
    products: "ürün",
    staff: "ekip üyesi",
    storage_mb: "depolama alanı",
    llm_credits_per_month: "aylık içerik taslağı",
    orders_per_month: "aylık sipariş",
    custom_domains: "özel alan adı",
  },
  en: {
    products: "product",
    staff: "team member",
    storage_mb: "storage",
    llm_credits_per_month: "monthly content draft",
    orders_per_month: "monthly order",
    custom_domains: "custom domain",
  },
}

/** `plan.limit_reached` in words: which limit, used and allowed (`{ limit, used, max }`). */
export function planLimitSentence(
  refusal: { limit?: string; used?: number; max?: number },
  locale: MessageLocale = "tr"
): string {
  const names = LIMIT_NAMES[locale]
  const limit = refusal.limit ?? ""
  const unit = limit === "storage_mb" ? " MB" : ""
  return serverErrorMessage("plan.limit_reached", locale, {
    limit: Object.hasOwn(names, limit) ? (names[limit] ?? limit) : limit,
    used: String(refusal.used ?? ""),
    max: `${String(refusal.max ?? "")}${unit}`,
  })
}
