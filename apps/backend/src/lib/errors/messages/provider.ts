import type { MessageLocale } from "./index"

/**
 * The sentence for a provider's failure (`provider.failed`) as staff read
 * it: the service by its name and, when it said something, its own words
 * (already made safe by `providerText`). No server code here either.
 */

const PROVIDER_NAMES: Readonly<Record<string, string>> = {
  aras: "Aras Kargo",
  dhlecommerce: "DHL eCommerce",
  surat: "Sürat Kargo",
  google: "Google",
  iyzico: "iyzico",
  meta: "Meta",
  netgsm: "Netgsm",
  parasut: "Paraşüt",
  paytr: "PayTR",
  shopify: "Shopify",
  turkiyeapi: "TürkiyeAPI",
  yurtici: "Yurtiçi Kargo",
}

export interface ProviderFailure {
  /** Our name of the service (`aras`). */
  provider: string
  /** What it said, made safe. */
  provider_message?: string | undefined
  /** It may answer if asked again (a 503): out of reach rather than refused. */
  retryable: boolean
}

/** The service's name as staff know it; our own name for one not listed. */
export const providerName = (provider: string): string =>
  Object.hasOwn(PROVIDER_NAMES, provider) ? (PROVIDER_NAMES[provider] ?? provider) : provider

const SENTENCES: Readonly<
  Record<
    MessageLocale,
    Record<"said" | "unreachable" | "failed", (name: string, text: string) => string>
  >
> = {
  tr: {
    said: (name, text) => `${name} yanıtı: “${text}”`,
    unreachable: (name) => `${name} hizmetine şu an ulaşılamıyor; biraz sonra tekrar deneyin.`,
    failed: (name) => `${name} ile işlem tamamlanamadı; biraz sonra tekrar deneyin.`,
  },
  en: {
    said: (name, text) => `${name} answered: “${text}”`,
    unreachable: (name) => `${name} cannot be reached right now; try again shortly.`,
    failed: (name) => `The request to ${name} could not be completed; try again shortly.`,
  },
}

export function providerFailureSentence(
  failure: ProviderFailure,
  locale: MessageLocale = "tr"
): string {
  const name = providerName(failure.provider)
  const sentences = SENTENCES[locale]
  if (failure.provider_message) {
    return sentences.said(name, failure.provider_message)
  }
  return (failure.retryable ? sentences.unreachable : sentences.failed)(name, "")
}
