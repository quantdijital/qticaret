import type { FormAction, HomeSectionView, PlaceOrderResult, Translate } from "@qticaret/ui"
import {
  BannerSection,
  BrandsSection,
  FaqSection,
  HelpBand,
  NewsletterSection,
  RichTextSection,
  TrustSection,
} from "./Blocks"
import { CategoryIndex } from "./CategoryIndex"
import { CloseUp } from "./CloseUp"
import { Opening, headingId } from "./Opening"
import type { Of } from "./plan"
import { ReviewsSection } from "./Reviews"
import { Shelf } from "./Shelf"
import { PostsSection } from "./Stories"

export type Subscribe = (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>

type Run = { kind: "shelf"; sections: Of<"products">[] } | { kind: "one"; section: HomeSectionView }

/** Product sections that stand next to each other share one shelf (tabs); the rest stand alone. */
function runs(sections: readonly HomeSectionView[]): Run[] {
  const out: Run[] = []
  for (const section of sections) {
    const last = out.at(-1)
    if (section.type === "products" && last?.kind === "shelf") {
      last.sections.push(section)
    } else if (section.type === "products") {
      out.push({ kind: "shelf", sections: [section] })
    } else {
      out.push({ kind: "one", section })
    }
  }
  return out
}

function Section({
  section,
  t,
  subscribe,
  quickAdd,
  shownPhotos,
}: {
  section: HomeSectionView
  t: Translate
  subscribe?: Subscribe | undefined
  quickAdd?: FormAction | undefined
  shownPhotos: ReadonlySet<string>
}) {
  switch (section.type) {
    case "hero":
      return <Opening opening={{ hero: section, categories: null, photo: null }} first={false} />
    case "banner":
      return <BannerSection section={section} label={t("home.banner")} />
    case "categories":
      return (
        <CategoryIndex
          id={headingId(section.id)}
          title={section.title}
          categories={section.categories}
          all={{ label: t("home.all_categories"), path: "/kategoriler" }}
        />
      )
    case "products":
      // Products always stand in a shelf run (`runs`)
      return null
    case "featured_product":
      return <CloseUp section={section} t={t} quickAdd={quickAdd} shownPhotos={shownPhotos} />
    case "brands":
      return <BrandsSection section={section} />
    case "posts":
      return <PostsSection section={section} />
    case "reviews":
      return <ReviewsSection section={section} t={t} />
    case "rich_text":
      return <RichTextSection section={section} />
    case "trust_badges":
      return <TrustSection section={section} t={t} />
    case "newsletter":
      return subscribe ? <NewsletterSection section={section} t={t} subscribe={subscribe} /> : null
    case "help":
      return <HelpBand section={section} t={t} />
    case "faq":
      return <FaqSection section={section} t={t} />
  }
}

/**
 * The shop's sections after the opening, in its order, each drawn by its
 * type (adr/0049); neighbouring product sections become one tabbed shelf,
 * its cards (and the close-up) with the quick add when the page passed one.
 */
export function Sections({
  sections,
  t,
  subscribe,
  quickAdd,
  openingPhoto,
}: {
  sections: readonly HomeSectionView[]
  t: Translate
  subscribe?: Subscribe | undefined
  quickAdd?: FormAction | undefined
  /** The opening's photograph (`home/Opening`), which the close-up does not show again. */
  openingPhoto?: string | null | undefined
}) {
  // The pictures the page already shows, so the close-up shows another of its product's
  const shownPhotos = new Set<string>(openingPhoto ? [openingPhoto] : [])
  for (const section of sections) {
    if (section.type === "products") {
      for (const product of section.products) {
        if (product.image) {
          shownPhotos.add(product.image.src)
        }
      }
    }
  }
  return runs(sections).map((run) =>
    run.kind === "shelf" ? (
      <Shelf key={run.sections[0]?.id} sections={run.sections} t={t} quickAdd={quickAdd} />
    ) : (
      <Section
        key={run.section.id}
        section={run.section}
        t={t}
        subscribe={subscribe}
        quickAdd={quickAdd}
        shownPhotos={shownPhotos}
      />
    )
  )
}
