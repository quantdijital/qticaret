import { PageTabs } from "@/components/patterns/page-tabs"
import type { PageTab } from "@/components/patterns/page-tabs"

export type SettingsTab = PageTab

/**
 * A settings page's parts as tabs (the owner, 2026-10-31: one page per
 * subject, its parts side by side instead of scattered pages): the
 * panel's `PageTabs`, its open tab in the address (`?part=`).
 */
export function SettingsTabs({ tabs, label }: { tabs: readonly SettingsTab[]; label: string }) {
  return <PageTabs tabs={tabs} label={label} />
}
