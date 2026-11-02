import type { HomePageView, HomeSectionView, PlaceOrderResult, Translate } from "@qticaret/ui"
import { Container } from "./components/Container"
import { BannerSection } from "./home/BannerSection"
import { BrandsSection, CategoriesSection, ProductsSection } from "./home/CatalogSections"
import { HelpBand } from "./home/HelpBand"
import { HeroSection } from "./home/HeroSection"
import {
  NewsletterSection,
  PostsSection,
  ReviewsSection,
  RichTextSection,
  TrustSection,
} from "./home/StorySections"

type Subscribe = (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>

function Section({
  section,
  index,
  t,
  subscribe,
}: {
  section: HomeSectionView
  index: number
  t: Translate
  subscribe?: Subscribe | undefined
}) {
  switch (section.type) {
    case "hero":
      return <HeroSection section={section} first={index === 0} />
    case "banner":
      return <BannerSection section={section} label={t("home.banner")} />
    case "categories":
      return <CategoriesSection section={section} />
    case "products":
      // The first rail near the top loads its first row at once
      return <ProductsSection section={section} t={t} eager={index < 3 ? 4 : 0} />
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
  }
}

/**
 * The home page as the shop laid it out in the theme editor (adr/0049):
 * its sections in its order, each drawn by its type. Without an opening
 * first, the page still has its one h1 (the shop's name, for the reader).
 */
export function HomePage({
  view,
  t,
  subscribe,
}: {
  view: HomePageView
  t: Translate
  subscribe?: Subscribe | undefined
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
      {view.sections.map((section, index) => (
        <Section key={section.id} section={section} index={index} t={t} subscribe={subscribe} />
      ))}
    </Container>
  )
}
