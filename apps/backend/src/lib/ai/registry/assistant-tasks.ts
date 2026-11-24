import { AI_ASSISTANT } from "../../../modules/platform-settings/features"
import { STAFF_ROLES } from "../../staff/permissions"
import type { AiTask } from "./tasks"

/**
 * The panel assistant (adr/0079): staff's words answered with the tools
 * of a closed list. Not one of `aiTasks()` (the suggestion route cannot
 * ask for it): only `POST /admin/ai/assistant/turns` runs it, under its
 * own daily group (`assistant`), each model call one credit. Every role
 * may use it while the shop's flag is on; the tools are narrowed by role.
 * Its reply is plain text through the shared gate; nothing of it is kept
 * but the usage rows, which hold no text.
 */
export const ASSISTANT_TASK: AiTask = {
  id: "assistant",
  capability: "text",
  mode: "sync",
  options: [],
  roles: STAFF_ROLES,
  credits: 1,
  gate: "plain_text",
  maxLength: 2_000,
  maxTokens: 1_000,
  flag: AI_ASSISTANT,
  keepData: false,
}
