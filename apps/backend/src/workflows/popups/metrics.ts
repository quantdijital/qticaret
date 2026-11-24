import type { MedusaContainer } from "@medusajs/framework/types"
import { popupState } from "../../lib/popups/eligibility"
import type { PopupRecord } from "../../lib/popups/eligibility"
import type { PopupEvent } from "../../lib/popups/rules"
import { POPUPS_MODULE } from "../../modules/popups"
import type PopupsModuleService from "../../modules/popups/service"

/**
 * Counts one storefront event of a pop-up on today's row (adr/0080 §7).
 * Only a pop-up switched on and within its dates is counted: an unknown
 * or dead id makes no row. A plain function, not a workflow: one counter
 * statement, nothing outside to undo, on a path every pop-up view takes.
 * True when it counted.
 */
export async function recordPopupEvent(
  container: Pick<MedusaContainer, "resolve">,
  id: string,
  event: PopupEvent,
  now: Date = new Date()
): Promise<boolean> {
  const service = container.resolve<PopupsModuleService>(POPUPS_MODULE)
  const [popup] = (await service.listPopups(
    { id },
    { select: ["id", "type", "is_active", "starts_at", "ends_at"], take: 1 }
  )) as unknown as PopupRecord[]
  // A campaign's promotion is not read again here: shown, it was live a moment ago
  if (!popup || popupState(popup, "live", now) !== "live") {
    return false
  }
  if (event === "signup" && popup.type !== "newsletter") {
    return false
  }
  await service.countEvent(id, now.toISOString().slice(0, 10), event)
  return true
}
