import { TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import { findSection } from "@/features/storefront/layout/sections"
import { useGoneRecords } from "./gone-records-context"
import { sectionLabel } from "./section-meta"

const G = "storefront.editor.goneRecords"

interface GoneRecordsNoticeProps {
  doc: LayoutDocument
  /** Opens a marked section's settings, on whichever page it stands. */
  onOpen: (id: string) => void
}

/** The note over the tree while some part of the design names a deleted record, each one opened from it. */
export function GoneRecordsNotice({ doc, onOpen }: GoneRecordsNoticeProps) {
  const { t } = useTranslation()
  const gone = useGoneRecords()
  if (gone.size === 0) {
    return null
  }
  // A free footer block is not a section of its own: counted, opened from its footer
  const found = [...gone].flatMap((id) => {
    const each = findSection(doc, id)
    return each ? [each] : []
  })
  return (
    <div
      role="status"
      className="mx-3 mt-3 flex flex-col gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2.5 text-[13px] leading-5 text-warning-text"
    >
      <p className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{t(`${G}.notice`, { count: gone.size })}</span>
      </p>
      {found.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {found.map(({ section, group }) => (
            <Button
              key={section.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onOpen(section.id)
              }}
            >
              {sectionLabel(t, section, group === "footer").name}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
