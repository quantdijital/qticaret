import { zodResolver } from "@hookform/resolvers/zod"
import { Link } from "@tanstack/react-router"
import { ListTree } from "lucide-react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { CardForm } from "@/components/patterns/card-form"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { ShopTokenPreview, TokenSlot } from "@/features/settings/components/shop-token-menu"
import {
  EmptyLine,
  ListFooter,
  RowActions,
  RowCell,
} from "@/features/settings/components/storefront-rows"
import {
  STOREFRONT_LIMITS,
  errorLine,
  knownTokens,
  lineSchema,
  useSaveStorefront,
} from "@/features/settings/storefront"
import { FULL_RESET } from "@/lib/forms"

const S = "settings.storefront"
const LIMITS = STOREFRONT_LIMITS

const announcementsSchema = z.object({
  // Rows of their own, so each line keeps its place while the list moves
  lines: z
    .array(z.object({ text: lineSchema(LIMITS.announcementLength).refine(...knownTokens) }))
    .max(LIMITS.announcements),
})
type AnnouncementValues = z.infer<typeof announcementsSchema>

const announcementsOf = (saved: StorefrontSettings): AnnouncementValues => ({
  lines: saved.announcements.map((text) => ({ text })),
})

/** The thin bar on top of every page: its lines, shown in turn; each may hold the shop's details. */
export function AnnouncementsCard({ saved }: { saved: StorefrontSettings }) {
  const { t } = useTranslation()
  const { save, saving } = useSaveStorefront()
  const values = announcementsOf(saved)
  const form = useForm<AnnouncementValues>({
    resolver: zodResolver(announcementsSchema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const lines = useFieldArray({ control: form.control, name: "lines" })
  const written = useWatch({ control: form.control, name: "lines" })
  const { errors, isSubmitted } = form.formState
  const submit = form.handleSubmit((next) => {
    save({ announcements: next.lines.map((line) => line.text) }, (stored) => {
      form.reset(announcementsOf(stored), FULL_RESET)
    })
  })
  return (
    <CardForm
      title={t(`${S}.announcements.title`)}
      description={t(`${S}.announcements.description`)}
      dirty={form.formState.isDirty}
      saving={saving}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      {lines.fields.length === 0 ? (
        <EmptyLine text={t(`${S}.announcements.empty`)} />
      ) : (
        <ol className="flex flex-col gap-2">
          {lines.fields.map((line, index) => {
            const number = index + 1
            const error = errorLine(t, errors.lines?.[index]?.text, LIMITS.announcementLength)
            const id = `storefront-announcement-${index}`
            const errorId = `${id}-error`
            return (
              <li key={line.id} className="flex items-start gap-2">
                <RowCell error={error} errorId={errorId} className="flex-1">
                  <TokenSlot
                    fieldId={id}
                    onInsert={(text) => {
                      form.setValue(`lines.${index}.text`, text, {
                        shouldDirty: true,
                        shouldValidate: isSubmitted,
                      })
                    }}
                  >
                    <Input
                      id={id}
                      aria-label={t(`${S}.announcements.line`, { number })}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? errorId : undefined}
                      placeholder={t(`${S}.announcements.placeholder`)}
                      className="pr-9"
                      {...form.register(`lines.${index}.text`)}
                    />
                  </TokenSlot>
                  <ShopTokenPreview text={written[index]?.text ?? ""} />
                </RowCell>
                <RowActions
                  index={index}
                  count={lines.fields.length}
                  item={t(`${S}.announcements.line`, { number })}
                  onMove={(to) => {
                    lines.move(index, to)
                  }}
                  onRemove={() => {
                    lines.remove(index)
                  }}
                />
              </li>
            )
          })}
        </ol>
      )}
      <ListFooter
        label={t(`${S}.announcements.add`)}
        hint={t(`${S}.announcements.hint`, {
          max: LIMITS.announcements,
          length: LIMITS.announcementLength,
        })}
        full={lines.fields.length >= LIMITS.announcements}
        onAdd={() => {
          lines.append({ text: "" })
        }}
      />
    </CardForm>
  )
}

/**
 * Where the menus went (adr/0049): the header's menu, the links above it
 * and the footer's columns are records under Storefront > Menus now.
 */
export function MenusMovedCard() {
  const { t } = useTranslation()
  return (
    <SectionCard title={t(`${S}.menusMoved.title`)}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="max-w-2xl flex-[1_1_20rem] text-[13px] text-muted-foreground">
          {t(`${S}.menusMoved.text`)}
        </p>
        <Button asChild variant="outline">
          <Link to="/storefront/menus">
            <ListTree />
            {t(`${S}.menusMoved.link`)}
          </Link>
        </Button>
      </div>
    </SectionCard>
  )
}
