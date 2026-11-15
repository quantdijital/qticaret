import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  CARD_BADGE_SWITCHES,
  CARD_BUTTON_STYLES,
  CARD_NO_REVIEWS,
  CARD_RATIOS,
  CARD_SOLD_OUT_ROWS,
  CARD_VARIANTS,
  FRAMED_CARD_SWITCHES,
} from "@/features/storefront/api/theme"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { PanelGroup } from "./panel-header"
import { ChoiceSelect, SwitchRow } from "./theme-fields"
import { THEME_FIELD, THEME_GROUP_TITLES } from "./forms/theme-registry"
import type { CardVariantsInUse, ThemeGroupName, ThemeRegistryField } from "./forms/theme-registry"

const C = "storefront.editor.theme"

type Card = ThemeSettings["product_card"]
type CardChoice = "ratio" | "variant" | "no_reviews" | "sold_out_row" | "button_style"

/** A card choice's list, as the registry names its options in this order. */
const LISTS: { [K in CardChoice]: readonly Card[K][] } = {
  ratio: CARD_RATIOS,
  variant: CARD_VARIANTS,
  no_reviews: CARD_NO_REVIEWS,
  sold_out_row: CARD_SOLD_OUT_ROWS,
  button_style: CARD_BUTTON_STYLES,
}

/** Two choices side by side once each gets 160 px. */
const Pair = ({ children }: { children: ReactNode }) => (
  <div className={cn("grid gap-4", "@min-[21rem]:grid-cols-2")}>{children}</div>
)

interface CardGroupsProps {
  theme: ThemeSettings
  variants: CardVariantsInUse
  reveal: (group: ThemeGroupName) => number | null
  onChange: (theme: ThemeSettings) => void
}

/**
 * The product card's groups (adr/0062, adr/0049 Ek 2026-11-14 §3.3 and Ek
 * 2026-11-15): the open "Ürün kartı" with its picture, variant, brand and
 * stars, the stars' place without reviews, the pills and a sold-out card's
 * row, every card's; then the framed card's switches and its button's
 * look. Each field's name, term, hint and element from the registry; one
 * meaningless now (`shown`) is not drawn.
 */
export function ThemeCardGroups({ theme, variants, reveal, onChange }: CardGroupsProps) {
  const { t } = useTranslation()
  const card = theme.product_card
  const set = (patch: Partial<Card>) => {
    onChange({ ...theme, product_card: { ...card, ...patch } })
  }
  const visible = (field: ThemeRegistryField) => field.shown(theme, variants)
  const termOf = (field: ThemeRegistryField) => (field.term ? t(field.term) : undefined)

  const choice = (name: CardChoice) => {
    const field = THEME_FIELD[`product_card.${name}`]
    const list: readonly string[] = LISTS[name]
    return visible(field) ? (
      <ChoiceSelect
        id={field.target}
        label={t(field.label)}
        term={termOf(field)}
        value={card[name]}
        options={list}
        onChange={(value) => {
          set({ [name]: value })
        }}
        render={(option) => t(field.options[list.indexOf(option)] ?? option)}
        hint={t(`${field.label}Hint`)}
      />
    ) : null
  }

  const toggle = (
    name:
      | "show_brand"
      | "show_rating"
      | (typeof CARD_BADGE_SWITCHES)[number]
      | (typeof FRAMED_CARD_SWITCHES)[number]
  ) => {
    const field = THEME_FIELD[`product_card.${name}`]
    return visible(field) ? (
      <SwitchRow
        key={name}
        id={field.target}
        label={t(field.label)}
        term={termOf(field)}
        hint={t(`${field.label}Hint`)}
        checked={card[name]}
        onChange={(value) => {
          set({ [name]: value })
        }}
      />
    ) : null
  }

  return (
    <>
      <PanelGroup title={t(THEME_GROUP_TITLES.card)} reveal={reveal("card")}>
        <Pair>
          {choice("ratio")}
          {choice("variant")}
        </Pair>
        {toggle("show_brand")}
        {toggle("show_rating")}
        {choice("no_reviews")}
        <p className="pt-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t(`${C}.badges`)}
        </p>
        {CARD_BADGE_SWITCHES.map(toggle)}
        {choice("sold_out_row")}
      </PanelGroup>
      {/* Read wherever a card is framed: a rail may frame its own while the shop's cards stay standard */}
      <PanelGroup title={t(THEME_GROUP_TITLES.framed)} reveal={reveal("framed")}>
        <p className="text-sm text-muted-foreground">{t(`${C}.framedHint`)}</p>
        {FRAMED_CARD_SWITCHES.map(toggle)}
        {choice("button_style")}
      </PanelGroup>
    </>
  )
}
