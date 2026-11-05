import type { FormAction, HomePageView, Translate } from "@qticaret/ui"
import { Container } from "./components/Container"
import { CategoryIndex } from "./home/CategoryIndex"
import { Opening, headingId, photoOf } from "./home/Opening"
import { OPENING_CATEGORIES, planHome } from "./home/plan"
import { Sections, type Subscribe } from "./home/Sections"

/**
 * The home page as the shop laid it out (adr/0049), in Atölye's shape
 * (design.md § System): an opening hero beside the shop's own photograph,
 * the categories that follow it as a ruled index (with their pictures as a
 * bento when the shop gave some), then every other section
 * of the shop's in its order (`home/Sections`). Without an opening
 * first, the page still has its one h1 (the shop's words "Ana sayfa", for
 * the reader).
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
  /** A shelf card's quick add (adr/0046 Ek 2026-11-04). */
  quickAdd?: FormAction | undefined
}) {
  const { opening, sections } = planHome(view.sections)
  const categories = opening?.categories ?? null
  return (
    <>
      {view.notice && (
        <Container className="pt-6">
          <p role="status" className="border-t-2 border-rule-ink bg-paper-2 p-4 text-sm">
            {view.notice}
          </p>
        </Container>
      )}
      {!opening && <h1 className="sr-only">{t("home.label")}</h1>}
      {opening && <Opening opening={opening} first />}
      {categories && categories.categories.length > 0 && (
        <CategoryIndex
          id={headingId(categories.id)}
          title={categories.title}
          categories={categories.categories}
          all={{ label: t("home.all_categories"), path: "/kategoriler" }}
          // On a phone the opening lists the first ones; with no more and no picture, no index there
          skipOnPhone={OPENING_CATEGORIES}
        />
      )}
      <Sections
        sections={sections}
        t={t}
        subscribe={subscribe}
        quickAdd={quickAdd}
        openingPhoto={opening ? (photoOf(opening)?.image.src ?? null) : null}
      />
    </>
  )
}
