import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { CardForm } from "@/components/patterns/card-form"
import { Input } from "@/components/ui/input"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { ShopTokenPreview, TokenSlot } from "@/features/settings/components/shop-token-menu"
import {
  EmptyLine,
  LinkRows,
  ListFooter,
  RowActions,
  RowCell,
} from "@/features/settings/components/storefront-rows"
import {
  STOREFRONT_LIMITS,
  errorLine,
  knownTokens,
  lineSchema,
  linkSchema,
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

const topLinksSchema = z.object({ links: z.array(linkSchema).max(LIMITS.topLinks) })
type TopLinkValues = z.infer<typeof topLinksSchema>

const topLinksOf = (saved: StorefrontSettings): TopLinkValues => ({
  links: saved.top_links.map(({ label, href }) => ({ label, href })),
})

/** The header's small links above the menu: about, contact, wholesale. */
export function TopLinksCard({ saved }: { saved: StorefrontSettings }) {
  const { t } = useTranslation()
  const { save, saving } = useSaveStorefront()
  const values = topLinksOf(saved)
  const form = useForm<TopLinkValues>({
    resolver: zodResolver(topLinksSchema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const links = useFieldArray({ control: form.control, name: "links" })
  const { errors } = form.formState
  const submit = form.handleSubmit((next) => {
    save({ top_links: next.links }, (stored) => {
      form.reset(topLinksOf(stored), FULL_RESET)
    })
  })
  return (
    <CardForm
      title={t(`${S}.topLinks.title`)}
      description={t(`${S}.topLinks.description`)}
      dirty={form.formState.isDirty}
      saving={saving}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      {links.fields.length === 0 ? (
        <EmptyLine text={t(`${S}.topLinks.empty`)} />
      ) : (
        <LinkRows
          rows={links.fields}
          idPrefix="storefront-top-link"
          register={(index, key) => form.register(`links.${index}.${key}`)}
          errors={(index) => errors.links?.[index]}
          onMove={(from, to) => {
            links.move(from, to)
          }}
          onRemove={(index) => {
            links.remove(index)
          }}
        />
      )}
      <ListFooter
        label={t(`${S}.links.add`)}
        hint={t(`${S}.topLinks.hint`, { max: LIMITS.topLinks })}
        full={links.fields.length >= LIMITS.topLinks}
        onAdd={() => {
          links.append({ label: "", href: "" })
        }}
      />
      {links.fields.length > 0 ? (
        <p className="text-[13px] text-muted-foreground">{t(`${S}.links.hrefHint`)}</p>
      ) : null}
    </CardForm>
  )
}
