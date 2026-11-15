import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { BodyGroup } from "@/features/storefront/api/layout"
import { usePreviewSamples } from "./use-preview-sample"
import type { PreviewSample, SamplePage } from "./use-preview-sample"

/**
 * The page the preview shows the draft on: the home page, or a sample
 * product's or category's page (the first live one until another is
 * picked; each page keeps its own pick while the editor is open).
 */
export function usePreviewTarget(page: BodyGroup) {
  const { t } = useTranslation()
  const [chosen, setChosen] = useState<Partial<Record<SamplePage, PreviewSample>>>({})
  const first = usePreviewSamples(page)
  /** A sample for a page, the current one or another (a page reached in the frame). */
  const chooseFor = (group: SamplePage, next: PreviewSample) => {
    setChosen((was) => ({ ...was, [group]: next }))
  }
  if (page === "home") {
    return {
      path: null,
      sample: null,
      finding: false,
      missing: null,
      choose: () => undefined,
      chooseFor,
    }
  }
  const sample = chosen[page] ?? first.data?.[0] ?? null
  const finding = !sample && first.isPending
  return {
    path: sample?.path ?? null,
    sample,
    finding,
    // None live yet (or none found): nothing to show the draft on
    missing: sample || finding ? null : t(`storefront.editor.sample.missing.${page}`),
    choose: (next: PreviewSample) => {
      chooseFor(page, next)
    },
    chooseFor,
  }
}
