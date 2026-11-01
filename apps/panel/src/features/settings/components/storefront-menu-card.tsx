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
  LINK_GRID,
  LinkRows,
  ListFooter,
  RowActions,
  RowCell,
} from "@/features/settings/components/storefront-rows"
import {
  FULL_RESET,
  STOREFRONT_LIMITS,
  errorLine,
  hrefSchema,
  lineSchema,
  linkSchema,
  useSaveStorefront,
} from "@/features/settings/storefront"

const S = "settings.storefront"
const M = `${S}.menu`
const LIMITS = STOREFRONT_LIMITS

const schema = z.object({
  items: z
    .array(
      z.object({
        label: lineSchema(LIMITS.menuLabelLength),
        href: hrefSchema,
        children: z.array(linkSchema).max(LIMITS.menuChildren),
      })
    )
    .max(LIMITS.menuItems),
})
type Values = z.infer<typeof schema>

const valuesOf = (saved: StorefrontSettings): Values => ({
  items: saved.menu.map((item) => ({
    label: item.label,
    href: item.href,
    children: item.children.map(({ label, href }) => ({ label, href })),
  })),
})

interface ItemProps {
  form: UseFormReturn<Values>
  index: number
  count: number
  onMove: (to: number) => void
  onRemove: () => void
}

/** One menu item: its own name and address, then the links its panel opens. */
function ItemEditor({ form, index, count, onMove, onRemove }: ItemProps) {
  const { t } = useTranslation()
  const children = useFieldArray({ control: form.control, name: `items.${index}.children` })
  const errors = form.formState.errors.items?.[index]
  const number = index + 1
  const item = t(`${M}.item`, { number })
  const id = `storefront-menu-${index}`
  const labelError = errorLine(t, errors?.label, LIMITS.menuLabelLength)
  const hrefError = errorLine(t, errors?.href)
  return (
    <li className="flex flex-col gap-3 border-t pt-5 first:border-t-0 first:pt-0">
      <div className="@container flex flex-col gap-2">
        <p className="text-sm font-medium">{item}</p>
        <div className={LINK_GRID}>
          <RowCell error={labelError} errorId={`${id}-label-error`} className="col-start-1">
            <Input
              aria-label={t(`${M}.labelOf`, { number })}
              aria-invalid={Boolean(labelError)}
              aria-describedby={labelError ? `${id}-label-error` : undefined}
              placeholder={t(`${M}.labelPlaceholder`)}
              {...form.register(`items.${index}.label`)}
            />
          </RowCell>
          <RowCell
            error={hrefError}
            errorId={`${id}-href-error`}
            className="col-span-2 @lg:col-span-1 @lg:col-start-2 @lg:row-start-1"
          >
            <Input
              aria-label={t(`${M}.hrefOf`, { number })}
              aria-invalid={Boolean(hrefError)}
              aria-describedby={hrefError ? `${id}-href-error` : undefined}
              placeholder={t(`${M}.hrefPlaceholder`)}
              autoComplete="off"
              spellCheck={false}
              {...form.register(`items.${index}.href`)}
            />
          </RowCell>
          <RowActions
            index={index}
            count={count}
            item={item}
            className="col-start-2 row-start-1 @lg:col-start-3"
            onMove={onMove}
            onRemove={onRemove}
          />
        </div>
      </div>
      {/* The links the item's panel opens, set in under it */}
      <div className="flex flex-col gap-3 border-l pl-4 sm:ml-4">
        <LinkRows
          rows={children.fields}
          idPrefix={`${id}-child`}
          within={item}
          register={(child, key) => form.register(`items.${index}.children.${child}.${key}`)}
          errors={(child) => errors?.children?.[child]}
          onMove={(from, to) => {
            children.move(from, to)
          }}
          onRemove={(child) => {
            children.remove(child)
          }}
        />
        <ListFooter
          label={t(`${M}.addChild`)}
          hint={t(`${M}.childrenHint`, { max: LIMITS.menuChildren })}
          full={children.fields.length >= LIMITS.menuChildren}
          onAdd={() => {
            children.append({ label: "", href: "" })
          }}
        />
      </div>
    </li>
  )
}

/**
 * The header's menu as the shop names it. With none, the storefront builds
 * it from the top categories and their children, so a new shop is never
 * without one.
 */
export function MenuCard({ saved }: { saved: StorefrontSettings }) {
  const { t } = useTranslation()
  const { save, saving } = useSaveStorefront()
  const values = valuesOf(saved)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const items = useFieldArray({ control: form.control, name: "items" })
  const submit = form.handleSubmit((next) => {
    save({ menu: next.items }, (stored) => {
      form.reset(valuesOf(stored), FULL_RESET)
    })
  })
  return (
    <CardForm
      title={t(`${M}.title`)}
      description={t(`${M}.description`)}
      dirty={form.formState.isDirty}
      saving={saving}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      {items.fields.length === 0 ? (
        <EmptyLine text={t(`${M}.empty`)} />
      ) : (
        <ol className="flex flex-col gap-5">
          {items.fields.map((item, index) => (
            <ItemEditor
              key={item.id}
              form={form}
              index={index}
              count={items.fields.length}
              onMove={(to) => {
                items.move(index, to)
              }}
              onRemove={() => {
                items.remove(index)
              }}
            />
          ))}
        </ol>
      )}
      <ListFooter
        label={t(`${M}.add`)}
        hint={t(`${M}.hint`, { max: LIMITS.menuItems })}
        full={items.fields.length >= LIMITS.menuItems}
        onAdd={() => {
          items.append({ label: "", href: "", children: [] })
        }}
      />
      {items.fields.length > 0 ? (
        <p className="text-[13px] text-muted-foreground">{t(`${S}.links.hrefHint`)}</p>
      ) : null}
    </CardForm>
  )
}
