import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import type { ShopVersion } from "./api"

/** Whether the shop runs its target, as `version.state.<key>` and a tone. */
export function matchWord(matches: ShopVersion["matches"]): {
  key: "match" | "drift" | "unknown"
  tone: StatusTone
} {
  if (matches === null) {
    return { key: "unknown", tone: "neutral" }
  }
  return matches ? { key: "match", tone: "success" } : { key: "drift", tone: "warning" }
}
