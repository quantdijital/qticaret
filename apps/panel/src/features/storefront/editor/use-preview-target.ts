import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { EditorPage } from "./editor-page"
import { useContentPage } from "./use-content-pages"
import { usePreviewSamples } from "./use-preview-sample"
import type { PreviewSample, SamplePage } from "./use-preview-sample"

/**
 * The page the preview shows the draft on: the home page, or a sample
 * product's or category's page (the first live one until another is
 * picked; each page keeps its own pick while the editor is open), or the
 * content page picked (adr/0073 §5), a draft one too.
 */
export function usePreviewTarget(
  page: EditorPage,
  content: string | null = null,
  /** The shop's content pages are still being read (none picked yet: the first is). */
  listing = false
) {
  const { t } = useTranslation()
  const [chosen, setChosen] = useState<Partial<Record<SamplePage, PreviewSample>>>({})
  const first = usePreviewSamples(page)
  const picked = useContentPage(page === "content" ? content : null)
  /** A sample for a page, the current one or another (a page reached in the frame). */
  const chooseFor = (group: SamplePage, next: PreviewSample) => {
    setChosen((was) => ({ ...was, [group]: next }))
  }
  if (page === "home" || page === "content") {
    const shown = page === "content" ? picked.page : null
    const finding = page === "content" && (picked.finding || (content === null && listing))
    return {
      path: shown?.path ?? null,
      sample: null,
      finding,
      // No page picked (none in İçerik yet), or the one in the address is gone
      missing:
        page === "content" && !shown && !finding
          ? t(`storefront.editor.contentPage.missing.${content === null ? "none" : "gone"}`)
          : null,
      /** The content page shown is a draft: only the editor's own session shows it. */
      draft: shown?.status === "draft",
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
    draft: false,
    choose: (next: PreviewSample) => {
      chooseFor(page, next)
    },
    chooseFor,
  }
}
