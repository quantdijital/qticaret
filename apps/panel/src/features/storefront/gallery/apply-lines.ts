import type { ApplyScope, ApplyTarget } from "./api"

/**
 * The lines that say what applying the look does and leaves alone (PLAN
 * §4.3). Its style alone (owner, 2026-11-28): the sections, header,
 * footer and menus all stay, a menu change waiting in the draft too.
 */
export function applyLines(
  target: ApplyTarget,
  draftChanged: boolean,
  pendingMenus: boolean,
  scope: ApplyScope = "full"
): string[] {
  const lines = ["vitrin", draftChanged ? "draftChanged" : "autoSave"]
  if (target.kind === "preset" && scope === "style") {
    lines.push("styleOnly", "menusKept", "shopData")
    return lines
  }
  if (target.kind === "preset") {
    const { has_header: header, has_footer: footer } = target.preset
    if (header && footer) {
      lines.push("frameReplaced")
    } else {
      lines.push(header ? "headerReplaced" : "headerKept", footer ? "footerReplaced" : "footerKept")
    }
    if (!target.preset.has_menus) {
      lines.push("menusKept")
    }
  } else {
    lines.push("menusNever")
  }
  if (pendingMenus) {
    lines.push("pendingMenusLost")
  }
  lines.push("shopData")
  return lines
}
