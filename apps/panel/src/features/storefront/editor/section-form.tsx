import type { AnySection, TrustBadge } from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { AnnouncementForm } from "./forms/announcement-form"
import { BannerForm } from "./forms/banner-form"
import { FaqForm } from "./forms/faq-form"
import { FeaturedForm } from "./forms/featured-form"
import { GoogleRatingForm } from "./forms/google-rating-form"
import { HeaderBarForm } from "./forms/header-bar-form"
import { HeroForm } from "./forms/hero-form"
import { HeroSliderForm } from "./forms/hero-slider-form"
import { MarqueeForm } from "./forms/marquee-form"
import { PriceBandsForm } from "./forms/price-bands-form"
import { ProductsForm } from "./forms/products-form"
import { RelatedForm } from "./forms/related-form"
import { RichTextForm } from "./forms/rich-text-form"
import { BrandsForm, CategoriesForm, CountedForm, WordedForm } from "./forms/simple-forms"
import { TrustBadgeList } from "./shared/trust-badge-list"

/** The form for one section type. */
export function FormOf({
  section,
  problems,
  onChange,
  badges,
  onBadges,
}: {
  section: AnySection
  problems: SectionProblems
  onChange: (section: AnySection, field?: string) => void
  badges: TrustBadge[]
  onBadges: (badges: TrustBadge[], field?: string) => void
}) {
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
      return <TrustBadgeList badges={badges} problems={problems} onChange={onBadges} />
    case "newsletter":
    case "help":
      return <WordedForm section={section} {...props} />
    case "header_bar":
      return <HeaderBarForm section={section} {...props} />
    // The other main sections have nothing of their own yet: their variant and look
    case "footer_bar":
    case "product_main":
    case "category_main":
      return null
  }
}
