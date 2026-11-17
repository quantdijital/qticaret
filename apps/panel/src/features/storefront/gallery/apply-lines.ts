import type { ApplyTarget } from "./api"

/** The lines that say what applying the look does and leaves alone (PLAN §4.3). */
export function applyLines(
  target: ApplyTarget,
  draftChanged: boolean,
  pendingMenus: boolean
): string[] {
  const lines = ["vitrin", draftChanged ? "draftChanged" : "autoSave"]
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
