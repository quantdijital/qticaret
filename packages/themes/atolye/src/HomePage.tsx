import type { FormAction, HomePageView, Translate } from "@qticaret/ui"
import { Container } from "./parts/Container"
import { Blocks, type Subscribe } from "./sections/Blocks"
import { blocksOf, openingProduct } from "./sections/plan"

/**
 * The home page as the shop laid it out (adr/0049), in this theme's
 * shape (docs/tema/yon-2026-11-05.md § Home): every section in the shop's
 * order, product sections side by side joined into one tabbed shelf, a
 * help section right after the FAQ drawn beside its questions. The
 * opening shows the hero's picture, else the shop's newest pictured
 * product. Without an opening first the page still has its one h1.
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
  quickAdd?: FormAction | undefined
}) {
  const [head] = blocksOf(view.sections)
  const opening = head?.kind === "one" ? head.section : null
  // An opening picture is the page's LCP: the hero's, the sliding opening's or a picture band's
  const opensWithPicture =
    opening?.type === "hero" || opening?.type === "hero_slider" || opening?.type === "banner"
  // A sliding opening heads the page with its first slide's heading, when it has one
  const ownsH1 =
    opening?.type === "hero" ||
    (opening?.type === "hero_slider" && Boolean(opening.slides[0]?.heading))
  return (
    <>
      {view.notice && (
        <Container className="pt-4">
          <p role="status" className="rounded-media bg-highlight-soft p-4 text-sm font-semibold">
            {view.notice}
          </p>
        </Container>
      )}
      {!ownsH1 && <h1 className="sr-only">{t("home.label")}</h1>}
      <Blocks
        sections={view.sections}
        t={t}
        subscribe={subscribe}
        quickAdd={quickAdd}
        heroFirst={opensWithPicture}
        opening={openingProduct(view.sections)}
      />
    </>
  )
}
