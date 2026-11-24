import "server-only"
import type { SearchFormView, Translate } from "@qticaret/ui"
import { storefrontSettings } from "@/lib/store-api/requests"
import { EMPTY_VALUES } from "./search-form"
import { currentSearchForm } from "./search-form-data"

/**
 * Whether the shop reads a search sentence into filters
 * (`ai.storefront_search`, adr/0077 §7; `/store/storefront` `features`);
 * off when the frame cannot be read.
 */
export async function naturalSearchOn(): Promise<boolean> {
  try {
    const { features } = await storefrontSettings()
    return features?.natural_search === true
  } catch {
    return false
  }
}

/**
 * The words under a search box while the shop reads sentences (adr/0077
 * §7, KVKK): a sentence may be written, personal details may not. Null
 * when off or when the box has no words field to write in.
 */
export const naturalHintOf = (on: boolean, form: SearchFormView, t: Translate): string | null =>
  on && form.words !== null ? t("search.natural_hint") : null

/** A `search_box` section's empty box, and its hint only while the shop reads sentences. */
export async function searchBoxParts(
  t: Translate
): Promise<{ form: SearchFormView; hint?: string }> {
  const [form, on] = await Promise.all([currentSearchForm(EMPTY_VALUES, t), naturalSearchOn()])
  const hint = naturalHintOf(on, form, t)
  return hint ? { form, hint } : { form }
}
