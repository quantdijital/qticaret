import { PageTabs } from "@qticaret/admin-ui/patterns/page-tabs"
import type { PageTab } from "@qticaret/admin-ui/patterns/page-tabs"

export type SettingsTab = PageTab

/**
 * A settings page's parts as tabs (the owner, 2026-10-31: one page per
 * subject, its parts side by side instead of scattered pages): the
 * panel's `PageTabs`, its open tab in the address (`?part=`).
 */
export function SettingsTabs({
  tabs,
  label,
  onOpen,
}: {
  tabs: readonly SettingsTab[]
  label: string
  onOpen?: (key: string) => void
}) {
  return <PageTabs tabs={tabs} label={label} {...(onOpen ? { onOpen } : {})} />
}
