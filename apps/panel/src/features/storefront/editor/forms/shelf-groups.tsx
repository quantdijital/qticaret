import { useTranslation } from "react-i18next"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import {
  SHELF_LIMITS,
  SHELF_PHONE_DEFAULT,
  scrollerSettingsOf,
  shelfPhoneColumnsOf,
} from "@qticaret/types"
import type { ProductsSection } from "@/features/storefront/api/layout"
import { switchVariant } from "@/features/storefront/layout/variants"
import { PanelGroup } from "../panel-header"
import { CardVariantField } from "./card-variant-field"
import { ColumnsField } from "./columns-field"
import type { FieldGroupName } from "./field-registry"
import { FIELD_IDS } from "./field-registry"
import { PhoneColumnsField } from "./phone-columns-field"
import { ScrollerFields } from "./scroller-fields"
import { ShelfTabsField } from "./shelf-tabs-field"
import { SCROLLER_MAIN } from "./scroller-groups"
import { VariantField } from "./variant-field"

const SH = "storefront.editor.shelf"

/** A count from a short list side by side ("2 sıra", "3 sıra"), each its own step in the history. */
function CountChoice<N extends number>({
  id,
  label,
  term,
  option,
  hint,
  counts,
  value,
  onChange,
}: {
  id: string
  label: string
  term: string
  option: (count: N) => string
  hint: string
  counts: readonly N[]
  value: N
  onChange: (count: N) => void
}) {
  return (
    <div id={id} className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-sm font-medium">
        {label} <small className="text-[11px] font-normal text-muted-foreground">{term}</small>
      </span>
      <ToggleGroup
        type="single"
        variant="outline"
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        value={String(value)}
        onValueChange={(next) => {
          const count = counts.find((each) => String(each) === next)
          if (count !== undefined) onChange(count)
        }}
        className="w-full"
      >
        {counts.map((count) => (
          <ToggleGroupItem
            key={count}
            value={String(count)}
            className="flex-1 text-[13px] data-[state=on]:bg-accent data-[state=on]:font-medium data-[state=on]:text-accent-foreground"
          >
            {option(count)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint}
      </p>
    </div>
  )
}

/**
 * A product rail's open groups under its content (adr/0049 Ek 2026-11-15):
 * "Diziliş" (the variant drawn in small, what that variant counts, the
 * card) and, on a carousel only, "Kaydırma" (cards in view, the arrows).
 * Its rarely changed scroller settings sit closed in "Diğer ayarlar"
 * (`SectionPanel`). A field the variant does not use is not shown: the
 * card on a compact or columns rail (always compact), the tabs switch on a
 * columns rail (it never joins).
 */
export function ShelfGroups({
  section,
  mates = [],
  reveal,
  onChange,
}: {
  section: ProductsSection
  /** The rails it shares one tabbed shelf with on the page (bilesen-denetimi (b) 2). */
  mates?: readonly ProductsSection[]
  reveal: (group: FieldGroupName) => number | null
  onChange: (section: ProductsSection) => void
}) {
  const { t } = useTranslation()
  const id = section.id
  const set = (next: Partial<ProductsSection>) => {
    onChange({ ...section, ...next })
  }
  const { variant } = section
  return (
    <>
      <PanelGroup
        name="layout"
        title={t("storefront.editor.panel.layout")}
        reveal={reveal("layout")}
      >
        <div className="flex flex-col gap-5">
          <VariantField
            id={FIELD_IDS.variant(id)}
            type="products"
            value={variant}
            onChange={(next) => {
              // Its own step in the history: "Geri al" brings the old variant back
              onChange(switchVariant(section, next))
            }}
          />
          {variant === "grid" ? (
            <>
              <div id={FIELD_IDS.shelf(id, "columns")}>
                <ColumnsField
                  id={`${id}-columns`}
                  value={section.columns ?? 3}
                  limit={section.limit}
                  onChange={(columns) => {
                    set({ columns })
                  }}
                />
              </div>
              <PhoneColumnsField
                id={FIELD_IDS.shelf(id, "columns_mobile")}
                value={shelfPhoneColumnsOf(section.columns_mobile)}
                fallback={SHELF_PHONE_DEFAULT}
                onChange={(columns_mobile) => {
                  set({ columns_mobile })
                }}
              />
            </>
          ) : variant === "compact" ? (
            <CountChoice
              id={FIELD_IDS.shelf(id, "rows")}
              label={t(`${SH}.rows`)}
              term={t(`${SH}.rowsTerm`)}
              option={(n) => t(`${SH}.rowsOption`, { n })}
              hint={t(`${SH}.rowsHint`)}
              counts={SHELF_LIMITS.compact.rows}
              value={section.rows ?? SHELF_LIMITS.compact.default}
              onChange={(rows) => {
                set({ rows })
              }}
            />
          ) : variant === "columns" ? (
            <CountChoice
              id={FIELD_IDS.shelf(id, "per_list")}
              label={t(`${SH}.perList`)}
              term={t(`${SH}.perListTerm`)}
              option={(n) => t(`${SH}.perListOption`, { n })}
              hint={t(`${SH}.perListHint`)}
              counts={SHELF_LIMITS.columns.per_list}
              value={section.per_list ?? SHELF_LIMITS.columns.default}
              onChange={(per_list) => {
                set({ per_list })
              }}
            />
          ) : variant === "featured" ? (
            <p className="text-xs text-muted-foreground">
              {t(`${SH}.featuredHint`, { n: SHELF_LIMITS.featured })}
            </p>
          ) : null}
          {variant === "compact" || variant === "columns" ? (
            <p className="text-xs text-muted-foreground">{t(`${SH}.cardCompact`)}</p>
          ) : (
            <CardVariantField
              id={FIELD_IDS.shelf(id, "card_variant")}
              value={section.card_variant ?? null}
              onChange={(card_variant) => {
                set({ card_variant })
              }}
            />
          )}
          {variant === "columns" ? null : (
            <ShelfTabsField
              id={FIELD_IDS.shelf(id, "tabs")}
              value={section.tabs}
              mates={mates}
              onChange={(tabs) => {
                set({ tabs })
              }}
            />
          )}
        </div>
      </PanelGroup>
      {variant === "carousel" ? (
        <PanelGroup
          name="scroll"
          title={t("storefront.editor.panel.scroll")}
          reveal={reveal("scroll")}
        >
          <ScrollerFields
            value={scrollerSettingsOf(section.scroller)}
            settings={SCROLLER_MAIN}
            fieldId={(setting) => FIELD_IDS.scroller(id, setting)}
            onChange={(scroller) => {
              set({ scroller })
            }}
          />
        </PanelGroup>
      ) : null}
    </>
  )
}
