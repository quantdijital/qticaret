import type { HomeSectionView, PlaceOrderResult, Translate } from "@qticaret/ui"
import { BannerSection } from "./BannerSection"
import { BrandsSection, CategoriesSection, ProductsSection } from "./CatalogSections"
import { FaqSection } from "./FaqSection"
import { HelpBand } from "./HelpBand"
import { HeroSection } from "./HeroSection"
import {
  NewsletterSection,
  PostsSection,
  ReviewsSection,
  RichTextSection,
  TrustSection,
} from "./StorySections"

export type Subscribe = (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>

function Section({
  section,
  index,
  atTop,
  t,
  subscribe,
}: {
  section: HomeSectionView
  index: number
  atTop: boolean
  t: Translate
  subscribe?: Subscribe | undefined
}) {
  switch (section.type) {
    case "hero":
      return <HeroSection section={section} first={atTop && index === 0} />
    case "banner":
      return <BannerSection section={section} label={t("home.banner")} />
    case "categories":
      return <CategoriesSection section={section} />
    case "products":
      // The first rail near the top loads its first row at once
      return <ProductsSection section={section} t={t} eager={atTop && index < 3 ? 4 : 0} />
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
 * The shop's sections in its order, each drawn by its type (adr/0049): the
 * home page's, and those below a product or around a category's grid.
 * `atTop`: the sections open the page, so the first picture and the first
 * rail's row load at once; elsewhere every picture waits its turn.
 */
export function Sections({
  sections,
  t,
  subscribe,
  atTop = false,
}: {
  sections: readonly HomeSectionView[]
  t: Translate
  subscribe?: Subscribe | undefined
  atTop?: boolean
}) {
  return sections.map((section, index) => (
    <Section
      key={section.id}
      section={section}
      index={index}
      atTop={atTop}
      t={t}
      subscribe={subscribe}
    />
  ))
}
