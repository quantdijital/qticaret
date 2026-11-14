import { Copy, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { BANNER_DEFAULTS, BANNER_SETTING_NAMES, MARQUEE_DEFAULTS } from "@qticaret/types"
import { Button } from "@qticaret/admin-ui/ui/button"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import type {
  AnySection,
  LayoutGroup,
  Placement,
  TrustBadge,
} from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { isBodyGroup } from "@/features/storefront/layout/sections"
import { lookCount } from "@/features/storefront/layout/look"
import { offersVariants, switchVariant } from "@/features/storefront/layout/variants"
import { AnnouncementForm } from "./forms/announcement-form"
import { BannerForm } from "./forms/banner-form"
import { FaqForm } from "./forms/faq-form"
import { FeaturedForm } from "./forms/featured-form"
import { FIELD_IDS, MARQUEE_LOOK_SETTINGS, takesLook } from "./forms/field-registry"
import type { FieldGroupName } from "./forms/field-registry"
import { GoogleRatingForm } from "./forms/google-rating-form"
import { HeroForm } from "./forms/hero-form"
import { HeroSliderForm } from "./forms/hero-slider-form"
import { LookFields } from "./forms/look-fields"
import { MarqueeForm } from "./forms/marquee-form"
import { BannerSettings } from "./forms/banner-settings"
import { MarqueeSettings } from "./forms/marquee-settings"
import { ProductsForm } from "./forms/products-form"
import { RelatedForm } from "./forms/related-form"
import { RichTextForm } from "./forms/rich-text-form"
import { ScheduleFields } from "./forms/schedule-fields"
import { HeaderBarForm } from "./forms/header-bar-form"
import { isMain } from "@/features/storefront/layout/main-sections"
import { VariantField } from "./forms/variant-field"
import { Panel, PanelGroup } from "./panel-header"
import { BrandsForm, CategoriesForm, CountedForm, WordedForm } from "./forms/simple-forms"
import { SECTION_ICONS, kindOf } from "./section-meta"
import { TrustBadgeList } from "./shared/trust-badge-list"
import { useFieldFocus } from "./use-field-focus"
import type { FieldFocus } from "./use-field-focus"

const P = "storefront.editor.panel"

interface SectionPanelProps {
  section: AnySection
  group: LayoutGroup
  problems: SectionProblems
  /** May another of it be added (a page's section under its page's limit). */
  canDuplicate: boolean
  onChange: (section: AnySection, field?: string) => void
  /** A category page's section to the other side of its products. */
  onPlace: (placement: Placement) => void
  onBack: () => void
  onDuplicate: () => void
  onRemove: () => void
  /** The theme's one list of trust badges, edited in every strip's form (adr/0049 Ek 2026-11-06). */
  badges: TrustBadge[]
  onBadges: (badges: TrustBadge[], field?: string) => void
  /** The field the settings search picked: its group opens, the field is shown and marked. */
  focus?: (FieldFocus & { group: FieldGroupName }) | null
}

/** The form for one section type. */
function FormOf({
  section,
  problems,
  onChange,
  badges,
  onBadges,
}: Pick<SectionPanelProps, "section" | "problems" | "onChange" | "badges" | "onBadges">) {
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

/**
 * A section's settings in their own column, as Shopify's editor opens
 * them: the way back to the page's parts, what the section is, its fields
 * in groups that fold away (how it is drawn when its type has variants,
 * where it sits on a category page, its own fields, a body section's look
 * closed at first (adr/0049 Ek 2026-11-14 §6), when it shows), then the
 * section copied or taken off (both undone with "Geri al"). A field the
 * settings search picked is opened, shown and marked.
 */
export function SectionPanel({
  section,
  group,
  problems,
  canDuplicate,
  onChange,
  onPlace,
  onBack,
  onDuplicate,
  onRemove,
  badges,
  onBadges,
  focus = null,
}: SectionPanelProps) {
  const { t } = useTranslation()
  const kind = kindOf(section, group === "footer")
  const name = t(`storefront.editor.types.${kind}.name`)
  useFieldFocus(focus)
  const reveal = (which: FieldGroupName) => (focus?.group === which ? focus.nonce : null)
  const looked = takesLook(section, group) ? section : null
  // A strip's own ground, speed, way and separator sit with the look; the header's has no look
  const strip = section.type === "marquee" ? section : null
  // The band's width, height, words' place, veil and buttons sit there too (E2)
  const band = section.type === "banner" ? section : null
  const set =
    (looked ? lookCount(looked) : 0) +
    (strip
      ? MARQUEE_LOOK_SETTINGS.filter((name) => strip[name] !== MARQUEE_DEFAULTS[name]).length
      : 0) +
    (band ? BANNER_SETTING_NAMES.filter((name) => band[name] !== BANNER_DEFAULTS[name]).length : 0)
  return (
    <Panel icon={SECTION_ICONS[kind]} title={name} onBack={onBack}>
      <p className="border-b px-5 py-4 text-[13px] leading-5 text-muted-foreground">
        {t(`storefront.editor.types.${kind}.description`)}
      </p>
      {offersVariants(section) ? (
        <PanelGroup title={t(`${P}.variant`)} reveal={reveal("variant")}>
          <VariantField
            id={FIELD_IDS.variant(section.id)}
            type={section.type}
            value={section.variant}
            onChange={(next) => {
              // Its own step in the history: "Geri al" brings the old variant back
              onChange(switchVariant(section, next))
            }}
          />
        </PanelGroup>
      ) : null}
      {"placement" in section ? (
        <PanelGroup title={t(`${P}.placement`)} reveal={reveal("placement")}>
          <RadioGroup
            id={FIELD_IDS.placement(section.id)}
            aria-label={t(`${P}.placement`)}
            value={section.placement}
            className="gap-3"
            onValueChange={(next) => {
              onPlace(next as Placement)
            }}
          >
            {(["top", "bottom"] as const).map((placement) => (
              <label key={placement} className="flex items-center gap-2 text-sm">
                <RadioGroupItem value={placement} />
                {t(`storefront.editor.tree.placements.${placement}`)}
              </label>
            ))}
          </RadioGroup>
        </PanelGroup>
      ) : null}
      {hasContent(section) ? (
        <PanelGroup title={t(`${P}.content`)} reveal={reveal("content")}>
          <FormOf
            section={section}
            problems={problems}
            onChange={onChange}
            badges={badges}
            onBadges={onBadges}
          />
        </PanelGroup>
      ) : null}
      {looked || strip ? (
        <PanelGroup
          title={
            set > 0
              ? t("storefront.editor.look.titleSet", { count: set })
              : t("storefront.editor.look.title")
          }
          hint={
            strip
              ? t(`storefront.editor.marquee.${looked ? "lookHint" : "headerLookHint"}`)
              : t("storefront.editor.look.hint")
          }
          defaultOpen={false}
          reveal={reveal("look")}
        >
          {strip ? (
            <MarqueeSettings
              section={strip}
              settings={MARQUEE_LOOK_SETTINGS}
              onChange={(next) => {
                onChange(next)
              }}
            />
          ) : null}
          {band ? <BannerSettings section={band} onChange={onChange} /> : null}
          {looked ? <LookFields section={looked} onChange={onChange} /> : null}
        </PanelGroup>
      ) : null}
      {/* A main section always shows and stays (adr/0049 Ek 2026-11-14 §5) */}
      {isMain(section) ? (
        <p className="border-t px-5 py-4 text-xs text-muted-foreground">
          {t("storefront.editor.main.fixed")}
        </p>
      ) : (
        <>
          <PanelGroup title={t(`${P}.visibility`)} reveal={reveal("visibility")}>
            <ScheduleFields section={section} problem={problems["schedule"]} onChange={onChange} />
          </PanelGroup>
          <SectionActions
            canCopy={isBodyGroup(group)}
            canDuplicate={canDuplicate}
            onDuplicate={onDuplicate}
            onRemove={onRemove}
          />
        </>
      )}
    </Panel>
  )
}

// The main sections whose content group would be empty: their variant and look are elsewhere
const hasContent = (section: AnySection) =>
  section.type !== "footer_bar" &&
  section.type !== "product_main" &&
  section.type !== "category_main"

/** The section copied (a page's body only) or taken off; both undone with "Geri al". */
function SectionActions({
  canCopy,
  canDuplicate,
  onDuplicate,
  onRemove,
}: {
  canCopy: boolean
  canDuplicate: boolean
  onDuplicate: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-2 border-t px-5 py-4">
      {canCopy ? (
        <Button type="button" variant="outline" disabled={!canDuplicate} onClick={onDuplicate}>
          <Copy />
          {t(`${P}.duplicate`)}
        </Button>
      ) : null}
      <Button type="button" variant="ghost" className="text-destructive-text" onClick={onRemove}>
        <Trash2 />
        {t(`${P}.remove`)}
      </Button>
    </div>
  )
}
