import type { UserEvent } from "@testing-library/user-event"
import { tabOfGroup } from "./panel-groups"
import type { SettingsTab } from "./panel-groups"

/**
 * The tests' way into a settings panel's tabs and closed groups (adr/0065
 * Ek, sekmeler), as a shop gets there: its tab picked, its header pressed.
 */

const groupNamed = (title: string | RegExp): HTMLElement => {
  const found = [...document.querySelectorAll<HTMLElement>("[data-panel-group-title]")].find(
    (element) => {
      const text = element.textContent
      return typeof title === "string" ? text === title : title.test(text)
    }
  )
  const group = found?.closest<HTMLElement>("[data-panel-group]")
  if (!group) {
    throw new Error(`No panel group titled ${String(title)}`)
  }
  return group
}

/** The tab's own button, if the panel has tabs. */
export const tabButton = (tab: SettingsTab): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[role="tab"][id$="-tab-${tab}"]`)

/** Picks a tab (nothing to do without tabs or when it is the one shown). */
export async function openTab(user: UserEvent, tab: SettingsTab) {
  const button = tabButton(tab)
  if (button && button.getAttribute("aria-selected") !== "true") {
    await user.click(button)
  }
}

/** Opens the group with this title: its tab picked, its header pressed if it is closed. */
export async function openGroup(user: UserEvent, title: string | RegExp): Promise<HTMLElement> {
  const group = groupNamed(title)
  await openTab(user, tabOfGroup(group.dataset["panelGroup"] ?? ""))
  const toggle = group.querySelector<HTMLElement>("h3 > button[aria-expanded]")
  if (toggle?.getAttribute("aria-expanded") === "false") {
    await user.click(toggle)
  }
  return group
}

/** Opens several groups in turn. */
export async function openGroups(user: UserEvent, ...titles: (string | RegExp)[]) {
  for (const title of titles) {
    await openGroup(user, title)
  }
}
