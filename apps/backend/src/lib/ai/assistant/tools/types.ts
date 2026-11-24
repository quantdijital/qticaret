import { z } from "@medusajs/framework/zod"
import type { StaffRole } from "../../../staff/permissions"
import type { ToolSpec } from "../../connectors/types"
import type { PanelScreen } from "../screens"

/**
 * A tool of the assistant (adr/0079 §3): a record in code, a closed list.
 * Its input is a strict Zod schema; the model sees the JSON Schema made
 * from it and every call is checked against the Zod schema again on the
 * server (a service may not enforce the limits). Y1 has `navigate` tools
 * only; `read` and `write` come with their own reviews (Y2, Y3).
 */

export type AssistantLocale = "tr" | "en"

export interface ToolContext {
  role: StaffRole
  locale: AssistantLocale
  /** The screens this person sees (`visibleScreens`): a tool never names another. */
  screens: readonly PanelScreen[]
}

/**
 * A tool's result (adr/0079 §6): `model` is what the model is shown,
 * `ui` what only the panel gets. `screens` are the keys the panel may
 * offer as a link from this result.
 */
export interface ToolOutput {
  model: unknown
  ui: unknown
  screens: readonly string[]
}

export interface AssistantTool<Input = unknown> {
  id: string
  kind: "navigate" | "read" | "write"
  /** For the model; fixed English, never a person's words. */
  description: string
  input: z.ZodType<Input>
  /** A tenant flag that must be on for the model to see it. */
  flag?: string
  roles?: readonly StaffRole[]
  run(context: ToolContext, input: Input): ToolOutput
}

/** The tool as the model is told of it: its name, its words, its argument schema. */
export function specOf(tool: AssistantTool): ToolSpec {
  const schema = z.toJSONSchema(tool.input) as Record<string, unknown>
  // The draft's address says nothing to the model
  const parameters = Object.fromEntries(
    Object.entries(schema).filter(([name]) => name !== "$schema")
  )
  return { name: tool.id, description: tool.description, parameters }
}
