import type { AnySection, TrustBadge } from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { AnnouncementForm } from "./forms/announcement-form"
import { BannerForm } from "./forms/banner-form"
import { FaqForm } from "./forms/faq-form"
import { FeaturedForm } from "./forms/featured-form"
import { FooterBarForm } from "./forms/footer-bar-form"
import { GoogleRatingForm } from "./forms/google-rating-form"
import { HeroForm } from "./forms/hero-form"
import { HeroSliderForm } from "./forms/hero-slider-form"
import { MarqueeForm } from "./forms/marquee-form"
import { NewsletterForm } from "./forms/newsletter-form"
import { PriceBandsForm } from "./forms/price-bands-form"
import { ProductsForm } from "./forms/products-form"
import { ProductMainForm } from "./forms/product-main-form"
import { RelatedForm } from "./forms/related-form"
import { RichTextForm } from "./forms/rich-text-form"
import { ContactForm, FactsNote } from "./forms/page-text-fields"
import { StripGalleryForm } from "./forms/strip-gallery-form"
import { StatsForm } from "./forms/stats-form"
import { StepsForm } from "./forms/steps-form"
import { SearchBoxForm } from "./forms/search-box-form"
import { CollageForm } from "./forms/collage-form"
import { DeparturesForm } from "./forms/departures-form"
import { BrandsForm, CategoriesForm, CountedForm, WordedForm } from "./forms/simple-forms"
import { TrustBadgeList } from "./shared/trust-badge-list"
import { NamedGroup } from "./named-group"

interface FormOfProps {
  section: AnySection
  problems: SectionProblems
  onChange: (section: AnySection, field?: string) => void
  badges: TrustBadge[]
  onBadges: (badges: TrustBadge[], field?: string) => void
}

/**
 * The sections whose content is long enough to split (docs/18 §7.1): their
 * forms draw their own groups, "İçerik" first and open, the rest closed
 * (the opening's buttons, the catalogue opening's parts, the cards, the
 * bands' pictures, how the questions open, the footer's button).
 */
const ownsGroups = (section: AnySection): boolean =>
  section.type === "hero" ||
  section.type === "hero_slider" ||
  section.type === "price_bands" ||
  section.type === "faq" ||
  section.type === "footer_bar" ||
  // The carded categories split off their cards; the tiles and the icon row do not
  (section.type === "categories" &&
    (section.variant === "linked" || section.variant === "collage" || section.variant === "panels"))

/**
 * A section's content in the panel's "İçerik" tab: its form inside the
 * one "İçerik" group, or the form's own groups when it splits its content.
 */
export function FormOf(props: FormOfProps) {
  return ownsGroups(props.section) ? (
    <FormBody {...props} />
  ) : (
    <NamedGroup name="content">
      <FormBody {...props} />
    </NamedGroup>
  )
}

/** The form for one section type. */
function FormBody({ section, problems, onChange, badges, onBadges }: FormOfProps) {
  const props = { problems, onChange }
  switch (section.type) {
    case "announcement_bar":
      return <AnnouncementForm section={section} {...props} />
    case "hero":
      return <HeroForm section={section} {...props} />
    case "hero_slider":
      return <HeroSliderForm section={section} {...props} />
    case "banner":
      return <BannerForm section={section} {...props} />
    case "strip_gallery":
      return <StripGalleryForm section={section} {...props} />
    case "stats":
      return <StatsForm section={section} {...props} />
    case "steps":
      return <StepsForm section={section} {...props} />
    case "search_box":
      return <SearchBoxForm section={section} {...props} />
    case "photo_collage":
      return <CollageForm section={section} {...props} />
    case "departures":
      return <DeparturesForm section={section} {...props} />
    case "categories":
      return <CategoriesForm section={section} {...props} />
    case "products":
      return <ProductsForm section={section} {...props} />
    case "featured_product":
      return <FeaturedForm section={section} {...props} />
    case "brands":
      return <BrandsForm section={section} {...props} />
    case "posts":
    case "reviews":
      return <CountedForm section={section} {...props} />
    case "google_rating":
      return <GoogleRatingForm section={section} {...props} />
    case "rich_text":
      return <RichTextForm section={section} {...props} />
    case "faq":
      return <FaqForm section={section} {...props} />
    case "related_products":
      return <RelatedForm section={section} {...props} />
    case "marquee":
      return <MarqueeForm section={section} {...props} />
    case "price_bands":
      return <PriceBandsForm section={section} {...props} />
    case "trust_badges":
      // The strip's problems are the badges' (`trust_badges.0.title`) and its schedule
      return (
        <TrustBadgeList
          badges={badges}
          problems={problems}
          onChange={onBadges}
          section={section.id}
        />
      )
    case "newsletter":
      return <NewsletterForm section={section} {...props} />
    case "help":
      return <WordedForm section={section} {...props} />
    // A content page's own (adr/0073 Ek 2026-11-19 (2) K2)
    case "contact":
      return <ContactForm section={section} {...props} />
    case "payment_facts":
    case "shipping_facts":
      return <FactsNote section={section} />
    case "footer_bar":
      return <FooterBarForm section={section} {...props} />
    // The header's settings stand in their own groups (`HeaderGroups`); the category's
    // grid has nothing of its own yet: its variant and look
    case "product_main":
      return <ProductMainForm section={section} {...props} />
    case "header_bar":
    case "category_main":
      return null
  }
}
