import type { MedusaRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { sendsCraft } from "../../../modules/platform-settings/sections/ai-guidance-craft"
import { staffRoleOf } from "../../http/staff-guard"

/**
 * A task's own craft (adr/0074 §3) is the owner's alone, while the rest
 * of the `ai_guidance` section is the owner's and the admin's: a body
 * that sends a craft or its version from anyone else is refused whole
 * with 403 `ai.guidance_craft_owner_only`, never saved without it, so the
 * sender knows. Checked on the body as validated (the section's schema
 * keeps a key only when it was sent).
 */
export async function refuseCraftUnlessOwner(req: MedusaRequest, tasks: unknown): Promise<void> {
  if (sendsCraft(tasks) && (await staffRoleOf(req)) !== "owner") {
    throw new MedusaError(MedusaError.Types.FORBIDDEN, "ai.guidance_craft_owner_only")
  }
}
