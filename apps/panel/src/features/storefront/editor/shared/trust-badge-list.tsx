import { Award, Clock, CreditCard, Gift, Phone, RefreshCw, ShieldCheck, Truck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useId } from "react"
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
import {
  EmptyLine,
  ListFooter,
  RowActions,
  RowCell,
} from "@/features/settings/components/storefront-rows"
import { STOREFRONT_LIMITS as L } from "@/features/settings/storefront"
import type { TrustBadge } from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { useProblemText } from "../forms/problem-text"

const B = "storefront.editor.shared.badges"

/** Each icon as the storefront draws it (docs/19 §4). */
const BADGE_ICONS: Record<TrustIcon, LucideIcon> = {
  truck: Truck,
  clock: Clock,
  shield: ShieldCheck,
  card: CreditCard,
  refresh: RefreshCw,
  award: Award,
  gift: Gift,
  phone: Phone,
}

interface TrustBadgeListProps {
  badges: TrustBadge[]
  /** The badges' mistakes by field (`trust_badges.0.title`), as the save would meet them. */
  problems: SectionProblems
  /** The new list; `field` names the field being typed in (one undo step per field). */
  onChange: (badges: TrustBadge[], field?: string) => void
}

/**
 * The shop's promises (fast shipping, easy returns): one list the whole
 * theme draws (adr/0049 Ek 2026-11-06), edited in every trust strip
 * section's form and from the product page's buy box. Part of the draft:
 * "Yayınla" puts them live with the rest of the design.
 */
export function TrustBadgeList({ badges, problems, onChange: set }: TrustBadgeListProps) {
  const { t } = useTranslation()
  const problem = useProblemText()
  // Two lists may be open at once (a strip's form and the buy box's dialog)
  const base = useId()
  const setOne = (index: number, change: Partial<TrustBadge>, field?: string) => {
    set(
      badges.map((badge, at) => (at === index ? { ...badge, ...change } : badge)),
      field
    )
  }
  // A new badge starts with an icon no other badge has yet
  const unusedIcon = (): TrustIcon =>
    TRUST_ICONS.find((icon) => !badges.some((badge) => badge.icon === icon)) ?? "truck"
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-5 text-muted-foreground">{t(`${B}.note`)}</p>
      {badges.length === 0 ? <EmptyLine text={t(`${B}.empty`)} /> : null}
      <ol className="flex flex-col gap-3">
        {badges.map((badge, index) => {
          const number = index + 1
          const id = `${base}-badge-${String(index)}`
          const at = `trust_badges.${String(index)}`
          const titleError = problem(problems[`${at}.title`], L.badgeTitleLength)
          const textError = problem(problems[`${at}.text`], L.badgeTextLength)
          return (
            <li key={index} className="flex flex-col gap-2 rounded-md border p-3">
              <div className="flex items-center gap-1">
                <Select
                  value={badge.icon}
                  onValueChange={(icon) => {
                    setOne(index, { icon: icon as TrustIcon })
                  }}
                >
                  <SelectTrigger
                    className="min-w-0 flex-1"
                    aria-label={t(`${B}.iconOf`, { number })}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRUST_ICONS.map((icon) => {
                      const Icon = BADGE_ICONS[icon]
                      return (
                        <SelectItem key={icon} value={icon}>
                          <Icon aria-hidden />
                          {t(`${B}.icons.${icon}`)}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <RowActions
                  index={index}
                  count={badges.length}
                  item={t(`${B}.item`, { number })}
                  onMove={(to) => {
                    const next = badges.filter((_, other) => other !== index)
                    next.splice(to, 0, badge)
                    set(next)
                  }}
                  onRemove={() => {
                    set(badges.filter((_, other) => other !== index))
                  }}
                />
              </div>
              <RowCell error={titleError} errorId={`${id}-title-error`}>
                <TokenSlot
                  fieldId={`${id}-title`}
                  onInsert={(title) => {
                    setOne(index, { title }, `${at}.title`)
                  }}
                >
                  <Input
                    id={`${id}-title`}
                    value={badge.title}
                    maxLength={L.badgeTitleLength}
                    aria-label={t(`${B}.titleOf`, { number })}
                    aria-invalid={Boolean(titleError)}
                    aria-describedby={titleError ? `${id}-title-error` : undefined}
                    placeholder={t(`${B}.titlePlaceholder`)}
                    className="pr-9"
                    onChange={(event) => {
                      setOne(index, { title: event.target.value }, `${at}.title`)
                    }}
                  />
                </TokenSlot>
                <ShopTokenPreview text={badge.title} />
              </RowCell>
              <RowCell error={textError} errorId={`${id}-text-error`}>
                <TokenSlot
                  fieldId={`${id}-text`}
                  onInsert={(text) => {
                    setOne(index, { text }, `${at}.text`)
                  }}
                >
                  <Input
                    id={`${id}-text`}
                    value={badge.text ?? ""}
                    maxLength={L.badgeTextLength}
                    aria-label={t(`${B}.textOf`, { number })}
                    aria-invalid={Boolean(textError)}
                    aria-describedby={textError ? `${id}-text-error` : undefined}
                    placeholder={t(`${B}.textPlaceholder`)}
                    className="pr-9"
                    onChange={(event) => {
                      // Empty is none: the badge shows its title alone
                      const text = event.target.value
                      setOne(index, { text: text.trim() === "" ? null : text }, `${at}.text`)
                    }}
                  />
                </TokenSlot>
                <ShopTokenPreview text={badge.text ?? ""} />
              </RowCell>
            </li>
          )
        })}
      </ol>
      <ListFooter
        label={t(`${B}.add`)}
        hint={t(`${B}.hint`, { max: L.badges })}
        full={badges.length >= L.badges}
        onAdd={() => {
          set([...badges, { icon: unusedIcon(), title: "", text: null }])
        }}
      />
      <p className="text-xs text-muted-foreground">{t(`${B}.tokens`)}</p>
    </div>
  )
}
