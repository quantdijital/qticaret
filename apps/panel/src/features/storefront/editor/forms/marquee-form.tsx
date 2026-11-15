import { useTranslation } from "react-i18next"
import { Input } from "@qticaret/admin-ui/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { TRUST_ICONS } from "@/features/settings/api/sections"
import type { TrustIcon } from "@/features/settings/api/sections"
import { ShopTokenPreview, TokenSlot } from "@/features/settings/components/shop-token-menu"
import { ListFooter, RowActions, RowCell } from "@/features/settings/components/storefront-rows"
import { MARQUEE_LIMITS as L } from "@/features/storefront/api/layout"
import type { HeaderMarquee, MarqueeItem, MarqueeSection } from "@/features/storefront/api/layout"
import { BADGE_ICONS } from "../shared/badge-icons"
import { LinkField } from "./link-field"
import { useProblemText } from "./problem-text"
import type { SectionFormProps } from "./form-props"
import { PREVIEW_IDS } from "./preview-fields"

const M = "storefront.editor.marquee"
const ICONS = "storefront.editor.shared.badges.icons"

/** The icon list's own value for "no icon": a Select cannot hold null. */
const NO_ICON = "none"

/** Empty is none: the item shows its line alone. */
const textOrNull = (text: string): string | null => (text.trim() === "" ? null : text)

type AnyMarquee = MarqueeSection | HeaderMarquee

/**
 * A scrolling strip (adr/0049 Ek 2026-11-14 §4.1): one to eight short
 * items, each with an optional icon, its line (it may hold the shop's
 * details), an optional second line and link. How it moves and looks
 * sits in the open "Hareket" and "Görünüm" groups below (`MarqueeGroups`).
 */
export function MarqueeForm<S extends AnyMarquee>({
  section,
  problems,
  onChange,
}: SectionFormProps<S>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const setItems = (items: MarqueeItem[], field?: string) => {
    onChange({ ...section, items }, field)
  }
  const setItem = (index: number, change: Partial<MarqueeItem>, field?: string) => {
    setItems(
      section.items.map((item, at) => (at === index ? { ...item, ...change } : item)),
      field
    )
  }
  const limit = problems["limit"]
  return (
    <div className="flex flex-col gap-5">
      {limit ? (
        <p role="alert" className="text-sm text-destructive-text">
          {t(`storefront.editor.problems.${limit}`, { max: L.perPage })}
        </p>
      ) : null}
      <div className="flex flex-col gap-3">
        <ol className="flex flex-col gap-3">
          {section.items.map((item, index) => {
            const number = index + 1
            const at = `items.${String(index)}`
            const id = PREVIEW_IDS.text(section.id, at)
            const textError = problem(problems[`${at}.text`], L.text)
            const subtextError = problem(problems[`${at}.subtext`], L.subtext)
            return (
              <li key={index} className="flex flex-col gap-2 rounded-md border p-3">
                <div className="flex items-center gap-1">
                  <Select
                    value={item.icon ?? NO_ICON}
                    onValueChange={(icon) => {
                      setItem(index, { icon: icon === NO_ICON ? null : (icon as TrustIcon) })
                    }}
                  >
                    <SelectTrigger
                      className="min-w-0 flex-1"
                      aria-label={t(`${M}.iconOf`, { number })}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ICON}>{t(`${M}.noIcon`)}</SelectItem>
                      {TRUST_ICONS.map((icon) => {
                        const Icon = BADGE_ICONS[icon]
                        return (
                          <SelectItem key={icon} value={icon}>
                            <Icon aria-hidden />
                            {t(`${ICONS}.${icon}`)}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <RowActions
                    index={index}
                    count={section.items.length}
                    item={t(`${M}.item`, { number })}
                    removable={section.items.length > L.items.min}
                    onMove={(to) => {
                      const next = section.items.filter((_, other) => other !== index)
                      next.splice(to, 0, item)
                      setItems(next)
                    }}
                    onRemove={() => {
                      setItems(section.items.filter((_, other) => other !== index))
                    }}
                  />
                </div>
                <RowCell error={textError} errorId={`${id}-text-error`}>
                  <TokenSlot
                    fieldId={`${id}-text`}
                    onInsert={(text) => {
                      setItem(index, { text }, `${at}.text`)
                    }}
                  >
                    <Input
                      id={`${id}-text`}
                      value={item.text}
                      maxLength={L.text}
                      aria-label={t(`${M}.textOf`, { number })}
                      aria-invalid={Boolean(textError)}
                      aria-describedby={textError ? `${id}-text-error` : undefined}
                      placeholder={t(`${M}.textPlaceholder`)}
                      className="pr-9"
                      onChange={(event) => {
                        setItem(index, { text: event.target.value }, `${at}.text`)
                      }}
                    />
                  </TokenSlot>
                  <ShopTokenPreview text={item.text} />
                </RowCell>
                <RowCell error={subtextError} errorId={`${id}-subtext-error`}>
                  <TokenSlot
                    fieldId={`${id}-subtext`}
                    onInsert={(subtext) => {
                      setItem(index, { subtext: textOrNull(subtext) }, `${at}.subtext`)
                    }}
                  >
                    <Input
                      id={`${id}-subtext`}
                      value={item.subtext ?? ""}
                      maxLength={L.subtext}
                      aria-label={t(`${M}.subtextOf`, { number })}
                      aria-invalid={Boolean(subtextError)}
                      aria-describedby={subtextError ? `${id}-subtext-error` : undefined}
                      placeholder={t(`${M}.subtextPlaceholder`)}
                      className="pr-9"
                      onChange={(event) => {
                        setItem(index, { subtext: textOrNull(event.target.value) }, `${at}.subtext`)
                      }}
                    />
                  </TokenSlot>
                  <ShopTokenPreview text={item.subtext ?? ""} />
                </RowCell>
                <LinkField
                  id={`${id}-link`}
                  label={t(`${M}.link`)}
                  link={item.link}
                  error={problem(problems[`${at}.link`])}
                  onChange={(link, field) => {
                    setItem(index, { link }, field && `${at}.link.label`)
                  }}
                />
              </li>
            )
          })}
        </ol>
        <ListFooter
          label={t(`${M}.add`)}
          hint={t(`${M}.hint`, { max: L.items.max })}
          full={section.items.length >= L.items.max}
          onAdd={() => {
            setItems([...section.items, { icon: null, text: "", subtext: null, link: null }])
          }}
        />
      </div>
    </div>
  )
}
