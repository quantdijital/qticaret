import type { FormAction, HomePageView, Translate } from "@qticaret/ui"
import { Container } from "./components/Container"
import { Sections, type Subscribe } from "./home/Sections"

/**
 * The home page as the shop laid it out in the theme editor (adr/0049):
 * its sections in its order, each drawn by its type. Without an opening
 * first, the page still has its one h1 (the shop's name, for the reader).
 */
export function HomePage({
  view,
  t,
  subscribe,
  quickAdd,
}: {
  view: HomePageView
  t: Translate
  subscribe?: Subscribe | undefined
  /** A rail card's quick add (adr/0046 Ek 2026-11-04). */
  quickAdd?: FormAction | undefined
}) {
  const opens = view.sections[0]?.type === "hero"
  return (
    <Container className="flex flex-col gap-20 pt-6 lg:gap-28 lg:pt-10">
      {view.notice && (
        <p role="status" className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm">
          {view.notice}
        </p>
      )}
      {!opens && <h1 className="sr-only">{t("home.label")}</h1>}
      <Sections sections={view.sections} t={t} subscribe={subscribe} quickAdd={quickAdd} atTop />
    </Container>
  )
}
