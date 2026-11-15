import { useTranslation } from "react-i18next"
import {
  BANNER_DEFAULTS,
  MARQUEE_DEFAULTS,
  SCROLLER_DEFAULTS,
  scrollerSettingsOf,
} from "@qticaret/types"
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
import { FIELD_IDS, MARQUEE_OTHER_SETTINGS, takesLook } from "./forms/field-registry"
import type { FieldGroupName } from "./forms/field-registry"
import { LookFields } from "./forms/look-fields"
import { MarqueeGroups } from "./forms/marquee-groups"
import { AnnouncementMotion } from "./forms/announcement-settings"
import { BannerSettings } from "./forms/banner-settings"
import { BANNER_OTHER_SETTINGS } from "./forms/banner-groups"
import { SectionLayoutGroup } from "./forms/layout-group"
import { MarqueeSettings } from "./forms/marquee-settings"
import { ScrollerFields } from "./forms/scroller-fields"
import { SCROLLER_OTHER } from "./forms/scroller-groups"
import { ShelfGroups } from "./forms/shelf-groups"
import { ScheduleFields } from "./forms/schedule-fields"
import { takesDevice } from "./forms/visibility-registry"
import { HeaderCatalogOther } from "./forms/header-catalog-other"
import { CategoryCardsOther } from "./forms/category-cards-fields"
import { cardsSetCount } from "./forms/card-field-ids"
import { isMain } from "@/features/storefront/layout/main-sections"
import { VariantField } from "./forms/variant-field"
import { Panel, PanelGroup } from "./panel-header"
import { SectionActions } from "./section-actions"
import { FormOf } from "./section-form"
import { SECTION_ICONS, kindOf } from "./section-meta"
import { useFieldFocus } from "./use-field-focus"
import type { FieldFocus } from "./use-field-focus"

const P = "storefront.editor.panel"

interface SectionPanelProps {
  section: AnySection
  group: LayoutGroup
  problems: SectionProblems
  /** May another of it be added (a page's section under its page's limit). */
  canDuplicate: boolean
  /** Why it may not be copied, when a per-page limit is what stops it. */
  duplicateNote?: string | null
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
  duplicateNote = null,
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
  // A strip moves and looks in two open groups; its screens and close button sit with the look
  const strip = section.type === "marquee" ? section : null
  // The band's width and buttons sit there too; its basics stand open in "Diziliş"
  const band = section.type === "banner" ? section : null
  // A product rail stands in "Diziliş"; a carousel's rarely changed scroller settings sit there too
  const shelf = section.type === "products" ? section : null
  const scroller = shelf?.variant === "carousel" ? scrollerSettingsOf(shelf.scroller) : null
  // The linked category cards' frame sits with the look (adr/0049 Ek 2026-11-15)
  const cards = section.type === "categories" && section.variant === "linked" ? section : null
  const set =
    cardsSetCount(section) +
    (scroller
      ? SCROLLER_OTHER.filter((name) => scroller[name] !== SCROLLER_DEFAULTS[name]).length
      : 0) +
    (looked ? lookCount(looked) : 0) +
    (strip
      ? MARQUEE_OTHER_SETTINGS.filter((name) => strip[name] !== MARQUEE_DEFAULTS[name]).length
      : 0) +
    (band ? BANNER_OTHER_SETTINGS.filter((name) => band[name] !== BANNER_DEFAULTS[name]).length : 0)
  return (
    <Panel icon={SECTION_ICONS[kind]} title={name} onBack={onBack}>
      <p className="border-b px-5 py-4 text-[13px] leading-5 text-muted-foreground">
        {t(`storefront.editor.types.${kind}.description`)}
      </p>
      {offersVariants(section) && !shelf ? (
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
      <SectionLayoutGroup section={section} reveal={reveal} onChange={onChange} />
      {strip ? <MarqueeGroups section={strip} reveal={reveal} onChange={onChange} /> : null}
      {section.type === "announcement_bar" ? (
        <AnnouncementMotion section={section} reveal={reveal} onChange={onChange} />
      ) : null}
      {shelf ? <ShelfGroups section={shelf} reveal={reveal} onChange={onChange} /> : null}
      {section.type === "header_bar" && section.variant === "catalog" ? (
        <HeaderCatalogOther
          section={section}
          problems={problems}
          reveal={reveal("look")}
          onChange={onChange}
        />
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
              settings={MARQUEE_OTHER_SETTINGS}
              onChange={(next) => {
                onChange(next)
              }}
            />
          ) : null}
          {shelf && scroller ? (
            <ScrollerFields
              value={scroller}
              settings={SCROLLER_OTHER}
              fieldId={(setting) => FIELD_IDS.scroller(shelf.id, setting)}
              onChange={(next) => {
                onChange({ ...shelf, scroller: next })
              }}
            />
          ) : null}
          {band ? (
            <BannerSettings section={band} settings={BANNER_OTHER_SETTINGS} onChange={onChange} />
          ) : null}
          {cards ? <CategoryCardsOther section={cards} onChange={onChange} /> : null}
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
            <ScheduleFields
              section={section}
              problem={problems["schedule"]}
              offersDevice={takesDevice(section, group)}
              onChange={onChange}
            />
          </PanelGroup>
          <SectionActions
            canCopy={isBodyGroup(group)}
            canDuplicate={canDuplicate}
            note={duplicateNote}
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
  section.type !== "product_main" && section.type !== "category_main"
