import { CircleCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { ApplyReport as Report } from "./api"

const R = "storefront.gallery.report"

/** The section names a skipped reference was in, once each: `home.kategoriler` → `kategoriler`. */
const refsOf = (report: Report) =>
  [...new Set(report.skipped.map((each) => each.ref))].slice(0, 3).join(", ")

/**
 * What the last apply did, said in the editor beside the draft it made
 * (PLAN §4.3): the look is in the draft, the draft before it was kept (and
 * under which name), sections left out for a record the shop lacks, the
 * shop's own header or footer kept. Closed with "Kapat".
 */
export function ApplyReport({ report, onClose }: { report: Report; onClose: () => void }) {
  const { t } = useTranslation()
  const sections = new Set(report.skipped.map((each) => each.where)).size
  return (
    <div
      role="status"
      className="mx-3 mt-3 flex flex-col gap-2 rounded-md border border-success/40 bg-success-soft px-3 py-2.5 text-[13px] leading-5 text-success-text"
    >
      <div className="flex items-start gap-2">
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="font-medium">{t(`${R}.applied`, { name: report.name })}</p>
          {report.auto_saved ? (
            <p>
              {report.saved_name
                ? t(`${R}.saved`, { saved: report.saved_name })
                : t(`${R}.savedAuto`)}
            </p>
          ) : null}
          {sections > 0 ? (
            <p>{t(`${R}.skipped`, { count: sections, refs: refsOf(report) })}</p>
          ) : null}
          {report.kept.length > 0 ? <p>{t(`${R}.kept`)}</p> : null}
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={onClose}>
        {t("common.close")}
      </Button>
    </div>
  )
}
