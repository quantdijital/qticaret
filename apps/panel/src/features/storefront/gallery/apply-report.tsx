import { CircleCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { ApplyReport as Report, SkippedRef } from "./api"

const R = "storefront.gallery.report"

/** A content page's layout left out for a page the shop has not made (adr/0073 §4). */
const isMissingPage = (each: SkippedRef) => each.where === "pages"

/** The section names a skipped reference was in, once each: `home.kategoriler` → `kategoriler`. */
const refsOf = (skipped: readonly SkippedRef[]) =>
  [...new Set(skipped.map((each) => each.ref))].slice(0, 3).join(", ")

/** `page:hakkimizda` → `hakkimizda`: the address the shop opens the page at. */
const handleOf = (ref: string) => ref.slice(ref.indexOf(":") + 1)

/**
 * What the last apply did, said in the editor beside the draft it made
 * (PLAN §4.3): the look is in the draft, the draft before it was kept (and
 * under which name), sections left out for a record the shop lacks, a
 * content page's layout left out for a page the shop has not made (with
 * how to bring it in), the shop's own header or footer and its own page
 * layouts kept. Closed with "Kapat".
 */
export function ApplyReport({ report, onClose }: { report: Report; onClose: () => void }) {
  const { t } = useTranslation()
  const skipped = report.skipped.filter((each) => !isMissingPage(each))
  const pages = report.skipped.filter(isMissingPage)
  const sections = new Set(skipped.map((each) => each.where)).size
  const keptPages = report.kept.some((each) => each.startsWith("pages."))
  const keptFrame = report.kept.some((each) => !each.startsWith("pages."))
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
            <p>{t(`${R}.skipped`, { count: sections, refs: refsOf(skipped) })}</p>
          ) : null}
          {pages.map((each) => (
            <p key={each.ref}>
              {each.name
                ? t(`${R}.pageMissing`, { name: each.name, handle: handleOf(each.ref) })
                : t(`${R}.pageMissingAddress`, { handle: handleOf(each.ref) })}
            </p>
          ))}
          {keptFrame ? <p>{t(`${R}.kept`)}</p> : null}
          {keptPages ? <p>{t(`${R}.keptPages`)}</p> : null}
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={onClose}>
        {t("common.close")}
      </Button>
    </div>
  )
}
