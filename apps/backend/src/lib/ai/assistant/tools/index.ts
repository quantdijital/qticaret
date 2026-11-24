import type { StaffRole } from "../../../staff/permissions"
import { explainScreenTool, findScreenTool } from "./navigate"
import type { AssistantTool } from "./types"

export type { AssistantLocale, AssistantTool, ToolContext, ToolOutput } from "./types"
export { specOf } from "./types"

/**
 * The assistant's tools (adr/0079 §3): a closed list in code. No tool
 * runs SQL, calls an address, reads a file or runs code, and none is
 * added that would; a writing tool never runs on the model's call (Y3).
 */
export const ASSISTANT_TOOLS: readonly AssistantTool[] = [findScreenTool, explainScreenTool]

/**
 * The tools this person's model may see this turn: their role among the
 * tool's roles (every role when it names none) and its flag on. A tool
 * left out here is unknown to the loop: a call to it is refused.
 */
export function toolsFor(
  role: StaffRole,
  enabledFeatures: ReadonlySet<string>,
  tools: readonly AssistantTool[] = ASSISTANT_TOOLS
): AssistantTool[] {
  return tools.filter(
    (tool) =>
      (tool.roles === undefined || tool.roles.includes(role)) &&
      (tool.flag === undefined || enabledFeatures.has(tool.flag))
  )
}
