import { zodResolver } from "@hookform/resolvers/zod"
import { Award, Clock, CreditCard, Gift, Phone, RefreshCw, ShieldCheck, Truck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { CardForm } from "@/components/patterns/card-form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TRUST_ICONS } from "@/features/settings/api/sections"
import type { StorefrontSettings, TrustIcon } from "@/features/settings/api/sections"
import {
  EmptyLine,
  ListFooter,
  RowActions,
  RowCell,
} from "@/features/settings/components/storefront-rows"
import {
  FULL_RESET,
  STOREFRONT_LIMITS,
  errorLine,
  lineSchema,
  optionalLineSchema,
  useSaveStorefront,
} from "@/features/settings/storefront"
import { cn } from "@/lib/utils"

const S = "settings.storefront"
const B = `${S}.badges`
const LIMITS = STOREFRONT_LIMITS

/** Each icon as the storefront draws it (docs/19 §4). */
const ICONS: Record<TrustIcon, LucideIcon> = {
  truck: Truck,
  clock: Clock,
  shield: ShieldCheck,
  card: CreditCard,
  refresh: RefreshCw,
  award: Award,
  gift: Gift,
  phone: Phone,
}

const schema = z.object({
  badges: z
    .array(
      z.object({
        icon: z.enum(TRUST_ICONS),
        title: lineSchema(LIMITS.badgeTitleLength),
        // Empty is saved as none: the badge shows its title alone
        text: optionalLineSchema(LIMITS.badgeTextLength),
      })
    )
    .max(LIMITS.badges),
})
type Values = z.infer<typeof schema>

const valuesOf = (saved: StorefrontSettings): Values => ({
  badges: saved.trust_badges.map((badge) => ({
    icon: badge.icon,
    title: badge.title,
    text: badge.text ?? "",
  })),
})

// Icon, title, text and actions side by side once the card is wide enough;
// on a narrow one the icon shares its line with the actions
const BADGE_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 @2xl:grid-cols-[minmax(0,11rem)_minmax(0,2fr)_minmax(0,3fr)_auto]"
const WIDE_CELL = "col-span-2 @2xl:col-span-1 @2xl:row-start-1"

/** The shop's promises (fast shipping, easy returns), under the header and beside "add to cart". */
export function TrustBadgesCard({ saved }: { saved: StorefrontSettings }) {
  const { t } = useTranslation()
  const { save, saving } = useSaveStorefront()
  const values = valuesOf(saved)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const badges = useFieldArray({ control: form.control, name: "badges" })
  const { errors } = form.formState
  const submit = form.handleSubmit((next) => {
    save(
      {
        trust_badges: next.badges.map((badge) => ({
          icon: badge.icon,
          title: badge.title,
          text: badge.text === "" ? null : badge.text,
        })),
      },
      (stored) => {
        form.reset(valuesOf(stored), FULL_RESET)
      }
    )
  })
  // A new badge starts with an icon no other badge has yet
  const unusedIcon = (): TrustIcon =>
    TRUST_ICONS.find((icon) => !form.getValues("badges").some((badge) => badge.icon === icon)) ??
    "truck"
  return (
    <CardForm
      title={t(`${B}.title`)}
      description={t(`${B}.description`)}
      dirty={form.formState.isDirty}
      saving={saving}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      {badges.fields.length === 0 ? (
        <EmptyLine text={t(`${B}.empty`)} />
      ) : (
        <div className="@container flex flex-col gap-2">
          <div
            aria-hidden
            className={cn(BADGE_GRID, "hidden text-xs font-medium text-muted-foreground @2xl:grid")}
          >
            <span>{t(`${B}.icon`)}</span>
            <span>{t(`${B}.badgeTitle`)}</span>
            <span>{t(`${B}.text`)}</span>
            <span className="w-29" />
          </div>
          <ol className="flex flex-col gap-3 @2xl:gap-2">
            {badges.fields.map((badge, index) => {
              const number = index + 1
              const id = `storefront-badge-${index}`
              const titleError = errorLine(
                t,
                errors.badges?.[index]?.title,
                LIMITS.badgeTitleLength
              )
              const textError = errorLine(t, errors.badges?.[index]?.text, LIMITS.badgeTextLength)
              return (
                <li key={badge.id} className={BADGE_GRID}>
                  <Controller
                    control={form.control}
                    name={`badges.${index}.icon`}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          className="col-start-1 row-start-1 w-full"
                          aria-label={t(`${B}.iconOf`, { number })}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRUST_ICONS.map((icon) => {
                            const Icon = ICONS[icon]
                            return (
                              <SelectItem key={icon} value={icon}>
                                <Icon aria-hidden />
                                {t(`${B}.icons.${icon}`)}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <RowCell
                    error={titleError}
                    errorId={`${id}-title-error`}
                    className={cn(WIDE_CELL, "@2xl:col-start-2")}
                  >
                    <Input
                      aria-label={t(`${B}.titleOf`, { number })}
                      aria-invalid={Boolean(titleError)}
                      aria-describedby={titleError ? `${id}-title-error` : undefined}
                      placeholder={t(`${B}.titlePlaceholder`)}
                      {...form.register(`badges.${index}.title`)}
                    />
                  </RowCell>
                  <RowCell
                    error={textError}
                    errorId={`${id}-text-error`}
                    className={cn(WIDE_CELL, "@2xl:col-start-3")}
                  >
                    <Input
                      aria-label={t(`${B}.textOf`, { number })}
                      aria-invalid={Boolean(textError)}
                      aria-describedby={textError ? `${id}-text-error` : undefined}
                      placeholder={t(`${B}.textPlaceholder`)}
                      {...form.register(`badges.${index}.text`)}
                    />
                  </RowCell>
                  <RowActions
                    index={index}
                    count={badges.fields.length}
                    item={t(`${B}.item`, { number })}
                    className="col-start-2 row-start-1 @2xl:col-start-4"
                    onMove={(to) => {
                      badges.move(index, to)
                    }}
                    onRemove={() => {
                      badges.remove(index)
                    }}
                  />
                </li>
              )
            })}
          </ol>
        </div>
      )}
      <ListFooter
        label={t(`${B}.add`)}
        hint={t(`${B}.hint`, { max: LIMITS.badges })}
        full={badges.fields.length >= LIMITS.badges}
        onAdd={() => {
          badges.append({ icon: unusedIcon(), title: "", text: "" })
        }}
      />
    </CardForm>
  )
}
