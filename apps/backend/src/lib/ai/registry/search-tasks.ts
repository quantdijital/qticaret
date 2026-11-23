import { AI_STOREFRONT_SEARCH } from "../../../modules/platform-settings/features"
import { AI_TEMPERATURE } from "./catalog-tasks"
import type { AiTask } from "./tasks"

/**
 * The storefront's search intent (adr/0077 §7, docs/22 Aşama 10a): a
 * shopper's sentence read into the search's filters. Not a staff task:
 * it is no part of `aiTasks()` (the panel's list, the suggestion route),
 * no role may ask for it there, and only `POST /store/search/interpret`
 * runs it, with the shop's own key (`own_key` services only), under its
 * own daily ceiling. Its answer is a filter, never a suggestion: nothing
 * is kept but the usage row, which holds no text.
 */
export const SEARCH_INTENT_TASK: AiTask = {
  id: "search_intent",
  capability: "text",
  mode: "sync",
  options: [],
  roles: [],
  credits: 1,
  gate: "search_intent",
  // The answer's JSON at its longest: a few fields of the shop's own values
  maxLength: 1_200,
  maxTokens: 400,
  flag: AI_STOREFRONT_SEARCH,
  keepData: false,
  json: true,
  temperature: AI_TEMPERATURE.structured,
}

/** What the usage row names as the asker: a shopper, never a person's id. */
export const STOREFRONT_REQUESTER = "vitrin"
