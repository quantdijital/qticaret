import { useTranslation } from "react-i18next"
import type { HeroListSource } from "@qticaret/types"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { RowActions } from "@/features/settings/components/storefront-rows"
import type {
  HeroCatalogFields as Fields,
  HeroSection,
  LayoutLink,
} from "@/features/storefront/api/layout"
import { HERO_CATALOG_LIMITS as H, LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { SwitchRow } from "../theme-fields"
import { FIELD_IDS } from "./field-registry"
import { CountField, FieldGroup, TextField } from "./fields"
import { ImageField } from "./image-field"
import { AddLinkButton, LinkCard } from "./link-field"
import { useProblemText } from "./problem-text"
import { RecordListField } from "./record-fields"
import { useLinkPicker } from "./use-link-picker"

const C = "storefront.editor.heroCatalog"

const LIST_KINDS: readonly HeroListSource["kind"][] = ["top", "menu", "manual"]

/** A list source of another kind; a hand-picked one starts empty. */
const listOf = (kind: HeroListSource["kind"]): HeroListSource =>
  kind === "manual" ? { kind, category_ids: [] } : { kind }

type CatalogHero = Extract<HeroSection, { variant: "category_list" }>

/**
 * H17's own fields under the opening's words (adr/0049 Ek 2026-11-14
 * §3.2): where the category list comes from and how many rows, counts on
 * or off, the two tiles beside the opening (a category, the shop's own
 * picture optional), up to four quick links, the products shown small with
 * their short labels, and the lowest price on or off.
 */
export function HeroCatalogFields({
  section,
  problems,
  onChange,
}: {
  section: CatalogHero
  problems: SectionProblems
  onChange: (section: CatalogHero, field?: string) => void
}) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const set = (next: Partial<Fields>, field?: string) => {
    onChange({ ...section, ...next }, field)
  }
  const setChips = (chips: LayoutLink[]) => {
    set({ chips })
  }
  const picker = useLinkPicker((link, was) => {
    setChips(
      was ? section.chips.map((each) => (each === was ? link : each)) : [...section.chips, link]
    )
  })
  const { list } = section
  return (
    <div className="flex flex-col gap-5 border-t pt-5">
      <FieldGroup title={t(`${C}.list`)} hint={t(`${C}.listHint`)}>
        <Field label={t(`${C}.listSource`)}>
          <RadioGroup
            aria-label={t(`${C}.listSource`)}
            value={list.kind}
            className="gap-2"
            onValueChange={(kind) => {
              if (kind !== list.kind) {
                set({ list: listOf(kind as HeroListSource["kind"]) })
              }
            }}
          >
            {LIST_KINDS.map((kind) => (
              <label key={kind} className="flex items-center gap-2 text-sm">
                <RadioGroupItem value={kind} />
                {t(`${C}.sources.${kind}`)}
              </label>
            ))}
          </RadioGroup>
        </Field>
        {list.kind === "manual" ? (
          <RecordListField
            kind="category"
            label={t("storefront.editor.records.categories")}
            ids={list.category_ids}
            max={H.listed}
            empty={t(`${C}.listEmpty`)}
            error={problem(problems["list"])}
            onChange={(category_ids) => {
              set({ list: { kind: "manual", category_ids } })
            }}
          />
        ) : null}
        <div id={FIELD_IDS.content(section.id, "list_limit")}>
          <CountField
            id={`${section.id}-list-limit`}
            label={t(`${C}.listLimit`)}
            term={t(`${C}.listLimitTerm`)}
            hint={t(`${C}.listLimitHint`, { min: H.list.min, max: H.list.max })}
            value={section.list_limit}
            min={H.list.min}
            max={H.list.max}
            onChange={(list_limit) => {
              set({ list_limit }, "list_limit")
            }}
          />
        </div>
        <div id={FIELD_IDS.content(section.id, "show_count")}>
          <SwitchRow
            id={`${section.id}-show-count`}
            label={t(`${C}.showCount`)}
            term={t(`${C}.showCountTerm`)}
            hint={t(`${C}.showCountHint`)}
            checked={section.show_count}
            onChange={(show_count) => {
              set({ show_count })
            }}
          />
        </div>
      </FieldGroup>
      <FieldGroup title={t(`${C}.tiles`)} hint={t(`${C}.tilesHint`, { max: H.tiles })}>
        <RecordListField
          kind="category"
          label={t("storefront.editor.records.categories")}
          ids={section.tiles.map((tile) => tile.category_id)}
          max={H.tiles}
          empty={t(`${C}.tilesEmpty`)}
          onChange={(ids) => {
            const was = new Map(section.tiles.map((tile) => [tile.category_id, tile.image]))
            set({ tiles: ids.map((id) => ({ category_id: id, image: was.get(id) ?? null })) })
          }}
        />
        {section.tiles.map((tile, index) => (
          <ImageField
            key={tile.category_id}
            id={`${section.id}-tile-${String(index)}`}
            label={t(`${C}.tileImage`, { number: index + 1 })}
            hint={t(`${C}.tileImageHint`)}
            image={tile.image}
            altError={problem(problems[`tiles.${String(index)}`], L.alt)}
            onChange={(image) => {
              set({
                tiles: section.tiles.map((each, at) => (at === index ? { ...each, image } : each)),
              })
            }}
          />
        ))}
      </FieldGroup>
      <FieldGroup title={t(`${C}.chips`)} hint={t(`${C}.chipsHint`, { max: H.chips })}>
        {section.chips.map((chip, index) => (
          <LinkCard
            key={`${String(index)}-${chip.kind}`}
            id={`${section.id}-chip-${String(index)}`}
            link={chip}
            error={problem(problems[`chips.${String(index)}`], L.label)}
            onChange={(next, field) => {
              set(
                { chips: section.chips.map((each, at) => (at === index ? next : each)) },
                field && `chips.${String(index)}.label`
              )
            }}
            onEdit={() => {
              picker.open(chip)
            }}
            actions={
              <RowActions
                index={index}
                count={section.chips.length}
                item={t(`${C}.chip`, { number: index + 1 })}
                onMove={(to) => {
                  const next = section.chips.filter((_, at) => at !== index)
                  next.splice(to, 0, chip)
                  setChips(next)
                }}
                onRemove={() => {
                  setChips(section.chips.filter((_, at) => at !== index))
                }}
              />
            }
          />
        ))}
        <AddLinkButton
          label={t(`${C}.addChip`)}
          disabled={section.chips.length >= H.chips}
          onClick={() => {
            picker.open(null)
          }}
        />
      </FieldGroup>
      <FieldGroup title={t(`${C}.picks`)} hint={t(`${C}.picksHint`, { max: H.picks })}>
        <RecordListField
          kind="product"
          label={t("storefront.editor.products.products")}
          ids={section.picks.map((pick) => pick.product_id)}
          max={H.picks}
          empty={t(`${C}.picksEmpty`)}
          onChange={(ids) => {
            const was = new Map(section.picks.map((pick) => [pick.product_id, pick.label]))
            set({ picks: ids.map((id) => ({ product_id: id, label: was.get(id) ?? null })) })
          }}
        />
        {section.picks.map((pick, index) => (
          <TextField
            key={pick.product_id}
            id={`${section.id}-pick-${String(index)}`}
            label={t(`${C}.pickLabel`, { number: index + 1 })}
            hint={t(`${C}.pickLabelHint`)}
            value={pick.label}
            max={H.pickLabel}
            placeholder={t(`${C}.pickLabelPlaceholder`)}
            error={problem(problems[`picks.${String(index)}`], H.pickLabel)}
            onChange={(label) => {
              set(
                {
                  picks: section.picks.map((each, at) =>
                    at === index ? { ...each, label } : each
                  ),
                },
                `picks.${String(index)}.label`
              )
            }}
          />
        ))}
        <div id={FIELD_IDS.content(section.id, "show_price")}>
          <SwitchRow
            id={`${section.id}-show-price`}
            label={t(`${C}.showPrice`)}
            term={t(`${C}.showPriceTerm`)}
            hint={t(`${C}.showPriceHint`)}
            checked={section.show_price}
            onChange={(show_price) => {
              set({ show_price })
            }}
          />
        </div>
      </FieldGroup>
      {picker.dialog}
    </div>
  )
}
