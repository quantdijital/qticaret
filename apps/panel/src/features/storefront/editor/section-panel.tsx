import { useTranslation } from "react-i18next"
import type { FooterBarVariant } from "@qticaret/types"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import type {
  AnySection,
  LayoutGroup,
  Placement,
  ProductsSection,
  TrustBadge,
} from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { isPageGroup } from "@/features/storefront/layout/sections"
import {
  offeredVariants,
  offersVariants,
  switchVariant,
} from "@/features/storefront/layout/variants"
import { FIELD_IDS, takesLook } from "./forms/field-registry"
import type { FieldGroupName } from "./forms/field-registry"
import { SpacingGroup } from "./forms/look-fields"
import { FrameGroup, OtherGroup } from "./forms/look-groups"
import { MarqueeGroups } from "./forms/marquee-groups"
import { AnnouncementMotion, AnnouncementStyle } from "./forms/announcement-settings"
import { FooterStyleGroup } from "./forms/footer-columns-fields"
import { NewsletterBandGroup } from "./forms/newsletter-band-group"
import { isFooterBand } from "./forms/newsletter-band"
import { HeaderGroups } from "./forms/header-bar-form"
import { SectionLayoutGroup } from "./forms/layout-group"
import { SliderGroups } from "./forms/slider-groups"
import { turnsAsSlider } from "./forms/slider-kit"
import { ShelfGroups } from "./forms/shelf-groups"
import { ScheduleFields } from "./forms/schedule-fields"
import { takesDevice } from "./forms/visibility-registry"
import { isMain } from "@/features/storefront/layout/main-sections"
import { VariantField } from "./forms/variant-field"
import { Panel, PanelGroup } from "./panel-header"
import { tabOfGroup } from "./panel-groups"
import { SectionActions } from "./section-actions"
import { FormOf } from "./section-form"
import { SECTION_ICONS, kindOf } from "./section-meta"
import { SettingsLayout } from "./settings-layout"
import { FieldFocusContext } from "./use-field-focus"
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
  /** A product rail's neighbours in one tabbed shelf on the page (bilesen-denetimi (b) 2). */
  shelfMates?: readonly ProductsSection[]
  /** The field the settings search or the preview picked: its tab and group open, it is focused. */
  focus?: (FieldFocus & { group: FieldGroupName }) | null
  /** The footer drawn another way: free rows fill from the footer group (adr/0070 §2.4). */
  onFooterVariant?: ((next: FooterBarVariant) => void) | undefined
}

/**
 * A section's settings in their own column, as Shopify's editor opens
 * them, split as Elementor splits a widget's (adr/0065 Ek, sekmeler): the
 * way back to the page's parts, what the section is, a search over all its
 * settings, then three tabs, "İçerik", "Stil", "Gelişmiş", each a few
 * groups closed down to their titles (`panel-groups.ts` says which group
 * stands where; the groups below are drawn in each tab's order), then the
 * section copied or taken off (both undone with "Geri al").
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
  shelfMates = [],
  focus = null,
  onFooterVariant,
}: SectionPanelProps) {
  const { t } = useTranslation()
  const kind = kindOf(section, group === "footer")
  const name = t(`storefront.editor.types.${kind}.name`)
  const reveal = (which: FieldGroupName) => (focus?.group === which ? focus.nonce : null)
  const looked = takesLook(section, group) ? section : null
  const strip = section.type === "marquee" ? section : null
  const shelf = section.type === "products" ? section : null
  // The sliding opening turns on the kit's settings it has use for (bilesen-denetimi (b) 4)
  // and so does the catalogue opening once it has two or more slides (adr/0049 Ek 2026-11-15)
  const slider = turnsAsSlider(section) ? section : null
  return (
    // A slide's field opens its dialog from the slide list (Faz 2b)
    <FieldFocusContext.Provider value={focus}>
      <Panel icon={SECTION_ICONS[kind]} title={name} onBack={onBack}>
        <p className="border-b px-5 py-4 text-[13px] leading-5 text-muted-foreground">
          {t(`storefront.editor.types.${kind}.description`)}
        </p>
        <SettingsLayout
          scope={`section:${section.type}`}
          resetKey={section.id}
          tabOf={tabOfGroup}
          focus={focus}
        >
          {/* İçerik */}
          {hasContent(section) ? (
            <FormOf
              section={section}
              problems={problems}
              onChange={onChange}
              badges={badges}
              onBadges={onBadges}
            />
          ) : null}
          {section.type === "header_bar" ? (
            <HeaderGroups
              section={section}
              problems={problems}
              reveal={reveal}
              onChange={onChange}
            />
          ) : null}
          {/* Stil: the variant first, open */}
          {offersVariants(section, group === "footer", group === "pages") ? (
            <PanelGroup
              name="variant"
              title={t(`${P}.variant`)}
              hint={t(`${P}.variantHint`)}
              reveal={reveal("variant")}
            >
              <VariantField
                id={FIELD_IDS.variant(section.id)}
                type={section.type}
                value={section.variant}
                offered={offeredVariants(section, group === "footer", group === "pages")}
                onChange={(next) => {
                  // Its own step in the history: "Geri al" brings the old variant back
                  if (section.type === "footer_bar" && onFooterVariant) {
                    onFooterVariant(next as FooterBarVariant)
                  } else {
                    onChange(switchVariant(section, next))
                  }
                }}
              />
            </PanelGroup>
          ) : null}
          {"placement" in section ? (
            <PanelGroup name="placement" title={t(`${P}.placement`)} reveal={reveal("placement")}>
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
          <SectionLayoutGroup section={section} reveal={reveal} onChange={onChange} />
          {shelf ? (
            <ShelfGroups section={shelf} mates={shelfMates} reveal={reveal} onChange={onChange} />
          ) : null}
          {slider ? <SliderGroups section={slider} reveal={reveal} onChange={onChange} /> : null}
          {strip ? <MarqueeGroups section={strip} reveal={reveal} onChange={onChange} /> : null}
          {section.type === "footer_bar" && section.variant !== "ledger" ? (
            <FooterStyleGroup section={section} reveal={reveal("appearance")} onChange={onChange} />
          ) : null}
          {isFooterBand(section, group) ? (
            <NewsletterBandGroup
              section={section}
              reveal={reveal("placement")}
              onChange={onChange}
            />
          ) : null}
          {section.type === "announcement_bar" ? (
            <>
              <AnnouncementMotion section={section} reveal={reveal} onChange={onChange} />
              <AnnouncementStyle section={section} reveal={reveal} onChange={onChange} />
            </>
          ) : null}
          <FrameGroup
            section={section}
            group={group}
            reveal={reveal("frame")}
            onChange={onChange}
          />
          {/* Gelişmiş */}
          {looked ? (
            <SpacingGroup section={looked} reveal={reveal("spacing")} onChange={onChange} />
          ) : null}
          {/* A main section always shows and stays (adr/0049 Ek 2026-11-14 §5) */}
          {isMain(section) ? null : (
            <PanelGroup
              name="visibility"
              title={t(`${P}.visibility`)}
              reveal={reveal("visibility")}
            >
              <ScheduleFields
                section={section}
                problem={problems["schedule"]}
                offersDevice={takesDevice(section, group)}
                onChange={onChange}
              />
            </PanelGroup>
          )}
          <OtherGroup section={section} reveal={reveal("look")} onChange={onChange} />
        </SettingsLayout>
        {isMain(section) ? (
          <p className="border-t px-5 py-4 text-xs text-muted-foreground">
            {t("storefront.editor.main.fixed")}
          </p>
        ) : (
          <SectionActions
            canCopy={isPageGroup(group)}
            canDuplicate={canDuplicate}
            note={duplicateNote}
            onDuplicate={onDuplicate}
            onRemove={onRemove}
          />
        )}
      </Panel>
    </FieldFocusContext.Provider>
  )
}

// The sections whose content group would be empty: the header's stand in their own groups,
// the category grid's variant and look are elsewhere
const hasContent = (section: AnySection) =>
  section.type !== "category_main" && section.type !== "header_bar"
