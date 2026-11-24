import { z } from "@medusajs/framework/zod"
import { searchScreens } from "../screens"
import type { PanelScreen } from "../screens"
import type { AssistantTool, ToolContext } from "./types"

/**
 * Y1, finding one's way (adr/0079 §4): the answer to "where do I change
 * it?" is a screen of the panel map, searched by word on the server; the
 * model only writes the query. Only the screens the person sees are ever
 * searched or explained.
 */

export const SCREEN_KEY = /^[A-Za-z0-9._-]{1,100}$/

const screenView = (screen: PanelScreen, context: ToolContext) => ({
  key: screen.key,
  label: screen.label,
  help: screen.help[context.locale],
})

const FindScreenInput = z.object({ query: z.string().trim().min(1).max(200) }).strict()

export const findScreenTool: AssistantTool<z.infer<typeof FindScreenInput>> = {
  id: "find_screen",
  kind: "navigate",
  description:
    "Search the shop admin panel for the screens where a task is done. Give the person's need in a few words (any language). Returns at most 5 screens as {key, label, help}.",
  input: FindScreenInput,
  run: (context, input) => {
    const found = searchScreens(input.query, context.screens)
    return {
      model: { screens: found.map((screen) => screenView(screen, context)) },
      ui: { screens: found.map((screen) => ({ key: screen.key, label: screen.label })) },
      screens: found.map((screen) => screen.key),
    }
  },
}

const ExplainScreenInput = z.object({ key: z.string().regex(SCREEN_KEY) }).strict()

export const explainScreenTool: AssistantTool<z.infer<typeof ExplainScreenInput>> = {
  id: "explain_screen",
  kind: "navigate",
  description:
    'Explain what is done on one screen of the admin panel, by its key as find_screen gave it. Returns {key, label, help}, or {error: "unknown_screen"}.',
  input: ExplainScreenInput,
  run: (context, input) => {
    const screen = context.screens.find((each) => each.key === input.key)
    if (screen === undefined) {
      return { model: { error: "unknown_screen" }, ui: null, screens: [] }
    }
    return {
      model: screenView(screen, context),
      ui: { key: screen.key, label: screen.label },
      screens: [screen.key],
    }
  },
}
