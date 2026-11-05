import type { FormAction, HomePageView, PlaceOrderResult, Translate } from "@qticaret/ui"
import { Container } from "./parts/Container"
import { Aisles } from "./sections/Aisles"
import { Brands } from "./sections/Brands"
import { Campaign } from "./sections/Campaign"
import { CustomerPhotos } from "./sections/CustomerPhotos"
import { Faq } from "./sections/Faq"
import { Guides } from "./sections/Guides"
import { Help } from "./sections/Help"
import { Hero } from "./sections/Hero"
import { type Block, blocksOf, headingId, openingProduct } from "./sections/plan"
import { Promises } from "./sections/Promises"
import { Reviews } from "./sections/Reviews"
import { Shelf } from "./sections/Shelf"
import { Signup } from "./sections/Signup"
import { Spotlight } from "./sections/Spotlight"
import { Story } from "./sections/Story"

/** A help section, when the block is one. */
const helpOf = (block: Block | undefined) =>
  block?.kind === "one" && block.section.type === "help" ? block.section : null

/** Whether the block is drawn by the one before it (a help section under the FAQ). */
const joined = (block: Block, before: Block | undefined) =>
  helpOf(block) !== null && before?.kind === "one" && before.section.type === "faq"

type Subscribe = (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>

interface Context {
  t: Translate
  subscribe?: Subscribe | undefined
  quickAdd?: FormAction | undefined
  opening: ReturnType<typeof openingProduct>
}

function BlockView({
  block,
  next,
  first,
  context,
}: {
  block: Block
  /** The block after it: a help section right after the FAQ joins it there. */
  next: Block | undefined
  first: boolean
  context: Context
}) {
  const { t, subscribe, quickAdd } = context
  if (block.kind === "shelf") {
    return <Shelf sections={block.sections} t={t} quickAdd={quickAdd} />
  }
  const { section } = block
  switch (section.type) {
    case "hero":
      return <Hero hero={section} product={first ? context.opening : null} first={first} />
    case "trust_badges":
      return <Promises badges={section.badges} label={t("footer.trust")} />
    case "categories":
      return (
        <Aisles
          id={headingId(section.id)}
          title={section.title}
          categories={section.categories}
          all={{ label: t("home.all_categories"), path: "/kategoriler" }}
        />
      )
    case "banner":
      return <Campaign section={section} label={t("home.banner")} />
    case "featured_product":
      return <Spotlight section={section} t={t} quickAdd={quickAdd} />
    case "reviews":
      return (
        <>
          <Reviews section={section} t={t} />
          {section.photos && section.photos.length > 0 && (
            <CustomerPhotos id={`${headingId(section.id)}-foto`} photos={section.photos} t={t} />
          )}
        </>
      )
    case "rich_text":
      return <Story section={section} />
    case "posts":
      return <Guides section={section} />
    case "faq":
      return <Faq section={section} help={helpOf(next)} t={t} />
    case "help":
      return <Help section={section} t={t} />
    case "newsletter":
      return subscribe ? <Signup section={section} t={t} subscribe={subscribe} /> : null
    case "brands":
      return <Brands section={section} />
  }
}

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
  const blocks = blocksOf(view.sections)
  const [head] = blocks
  const opensWithHero = head?.kind === "one" && head.section.type === "hero"
  const context: Context = { t, subscribe, quickAdd, opening: openingProduct(view.sections) }
  return (
    <>
      {view.notice && (
        <Container className="pt-4">
          <p role="status" className="rounded-media bg-signal-soft p-4 text-sm font-semibold">
            {view.notice}
          </p>
        </Container>
      )}
      {!opensWithHero && <h1 className="sr-only">{t("home.label")}</h1>}
      {blocks.map((block, index) =>
        joined(block, blocks[index - 1]) ? null : (
          <BlockView
            key={block.kind === "shelf" ? (block.sections[0]?.id ?? "raf") : block.section.id}
            block={block}
            next={blocks[index + 1]}
            first={index === 0 && opensWithHero}
            context={context}
          />
        )
      )}
    </>
  )
}
