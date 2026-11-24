import type { LayoutDocument } from "@/features/storefront/api/layout"
import { useApplyReport } from "@/features/storefront/gallery/api"
import { ApplyReport } from "@/features/storefront/gallery/apply-report"
import { GoneRecordsNotice } from "./gone-records"
import { PendingMenus } from "./pending-menus"

interface EditorNoticesProps {
  doc: LayoutDocument
  /** Opens a section's settings: one naming a deleted record. */
  onOpenSection: (id: string) => void
  /** The menu set the draft would put live; null: none. */
  pendingMenus: readonly unknown[] | null
  onDropMenus: () => void
}

/**
 * The notes over the page's parts: what the last look applied from the
 * gallery did (adr/0064 Ek 2026-11-17), the sections naming a record
 * deleted since, and a menu set waiting in the draft (adr/0063 §3).
 */
export function EditorNotices({
  doc,
  onOpenSection,
  pendingMenus,
  onDropMenus,
}: EditorNoticesProps) {
  const [report, dismiss] = useApplyReport()
  return (
    <>
      {report ? <ApplyReport report={report} onClose={dismiss} /> : null}
      <GoneRecordsNotice doc={doc} onOpen={onOpenSection} />
      {pendingMenus ? <PendingMenus count={pendingMenus.length} onDrop={onDropMenus} /> : null}
    </>
  )
}
