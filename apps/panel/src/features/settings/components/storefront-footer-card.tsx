import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { CardForm } from "@/components/patterns/card-form"
import { Input } from "@/components/ui/input"
import type { StorefrontSettings } from "@/features/settings/api/sections"
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
  lineSchema,
  linkSchema,
  useSaveStorefront,
} from "@/features/settings/storefront"

const S = "settings.storefront"
const F = `${S}.footer`
const LIMITS = STOREFRONT_LIMITS

const schema = z.object({
  groups: z
    .array(
      z.object({
        title: lineSchema(LIMITS.groupTitleLength),
        links: z.array(linkSchema).min(1).max(LIMITS.groupLinks),
      })
    )
    .max(LIMITS.footerGroups),
})
type Values = z.infer<typeof schema>

const valuesOf = (saved: StorefrontSettings): Values => ({
  groups: saved.footer_groups.map((group) => ({
    title: group.title,
    links: group.links.map(({ label, href }) => ({ label, href })),
  })),
})

interface GroupProps {
  form: UseFormReturn<Values>
  index: number
  count: number
  onMove: (to: number) => void
  onRemove: () => void
}

/** One footer column: its title, then its links. */
function GroupEditor({ form, index, count, onMove, onRemove }: GroupProps) {
  const { t } = useTranslation()
  const links = useFieldArray({ control: form.control, name: `groups.${index}.links` })
  const errors = form.formState.errors.groups?.[index]
  const number = index + 1
  const group = t(`${F}.group`, { number })
  const titleId = `storefront-footer-${index}-title`
  const titleError = errorLine(t, errors?.title, LIMITS.groupTitleLength)
  return (
    <li className="flex flex-col gap-3 border-t pt-5 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-2">
        <label htmlFor={titleId} className="text-sm font-medium">
          {t(`${F}.groupTitle`, { number })}
        </label>
        <div className="flex items-start gap-2">
          <RowCell error={titleError} errorId={`${titleId}-error`} className="flex-1">
            <Input
              id={titleId}
              aria-invalid={Boolean(titleError)}
              aria-describedby={titleError ? `${titleId}-error` : undefined}
              placeholder={t(`${F}.groupPlaceholder`)}
              {...form.register(`groups.${index}.title`)}
            />
          </RowCell>
          <RowActions
            index={index}
            count={count}
            item={group}
            onMove={onMove}
            onRemove={onRemove}
          />
        </div>
      </div>
      <LinkRows
        rows={links.fields}
        idPrefix={`storefront-footer-${index}-link`}
        within={group}
        minimum={1}
        register={(link, key) => form.register(`groups.${index}.links.${link}.${key}`)}
        errors={(link) => errors?.links?.[link]}
        onMove={(from, to) => {
          links.move(from, to)
        }}
        onRemove={(link) => {
          links.remove(link)
        }}
      />
      <ListFooter
        label={t(`${S}.links.add`)}
        hint={t(`${F}.linksHint`, { max: LIMITS.groupLinks })}
        full={links.fields.length >= LIMITS.groupLinks}
        onAdd={() => {
          links.append({ label: "", href: "" })
        }}
      />
    </li>
  )
}

/**
 * The footer's link columns. With none, the storefront fills the footer
 * itself (the categories and a help column), so a new shop is never bare.
 */
export function FooterGroupsCard({ saved }: { saved: StorefrontSettings }) {
  const { t } = useTranslation()
  const { save, saving } = useSaveStorefront()
  const values = valuesOf(saved)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const groups = useFieldArray({ control: form.control, name: "groups" })
  const submit = form.handleSubmit((next) => {
    save({ footer_groups: next.groups }, (stored) => {
      form.reset(valuesOf(stored))
    })
  })
  return (
    <CardForm
      title={t(`${F}.title`)}
      description={t(`${F}.description`)}
      dirty={form.formState.isDirty}
      saving={saving}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values)
      }}
    >
      {groups.fields.length === 0 ? (
        <EmptyLine text={t(`${F}.empty`)} />
      ) : (
        <ol className="flex flex-col gap-5">
          {groups.fields.map((group, index) => (
            <GroupEditor
              key={group.id}
              form={form}
              index={index}
              count={groups.fields.length}
              onMove={(to) => {
                groups.move(index, to)
              }}
              onRemove={() => {
                groups.remove(index)
              }}
            />
          ))}
        </ol>
      )}
      <ListFooter
        label={t(`${F}.addGroup`)}
        hint={t(`${F}.hint`, { max: LIMITS.footerGroups })}
        full={groups.fields.length >= LIMITS.footerGroups}
        onAdd={() => {
          groups.append({ title: "", links: [{ label: "", href: "" }] })
        }}
      />
      {groups.fields.length > 0 ? (
        <p className="text-[13px] text-muted-foreground">{t(`${S}.links.hrefHint`)}</p>
      ) : null}
    </CardForm>
  )
}
