import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useSaveSection } from "@/features/settings/api/sections"
import type { LegalSettings } from "@/features/settings/api/sections"
import {
  EmptyLine,
  ListFooter,
  RowActions,
  RowCell,
} from "@/features/settings/components/storefront-rows"
import { errorLine } from "@/features/settings/storefront"
import { errorText } from "@/lib/errors"
import { FULL_RESET, beginSave } from "@qticaret/admin-ui/lib/forms"

const S = "settings.store.social"
const E = "settings.store.errors"
// The server's limits (legal section `same_as`)
const MAX_ACCOUNTS = 10
const MAX_URL_LENGTH = 500

const schema = z.object({
  // Rows of their own, so each address keeps its place while the list moves
  accounts: z
    .array(
      z.object({
        url: z
          .string()
          .trim()
          .min(1, `${E}.required`)
          .max(MAX_URL_LENGTH, `${E}.tooLong`)
          .regex(/^https:\/\/\S+$/i, `${E}.urlInvalid`),
      })
    )
    .max(MAX_ACCOUNTS),
})
type Values = z.infer<typeof schema>

const valuesOf = (saved: LegalSettings): Values => ({
  accounts: saved.same_as.map((url) => ({ url })),
})

/**
 * The shop's social accounts (adr/0048): the storefront's footer links
 * them, and Google's structured data names them as the shop's own
 * (`sameAs`). Kept with the legal identity, saved as a whole list.
 */
export function SocialAccountsCard({
  saved,
  className,
}: {
  saved: LegalSettings
  className?: string
}) {
  const { t } = useTranslation()
  const save = useSaveSection<LegalSettings>("legal")
  const values = valuesOf(saved)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const accounts = useFieldArray({ control: form.control, name: "accounts" })
  const { errors } = form.formState
  const submit = form.handleSubmit((next) => {
    const settle = beginSave(form)
    save.mutate(
      { same_as: next.accounts.map((account) => account.url) },
      {
        onSuccess: (result) => {
          settle(valuesOf(result.values))
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      title={t(`${S}.title`)}
      description={t(`${S}.description`)}
      className={className}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      {accounts.fields.length === 0 ? (
        <EmptyLine text={t(`${S}.empty`)} />
      ) : (
        <ol className="flex flex-col gap-2">
          {accounts.fields.map((account, index) => {
            const number = index + 1
            const error = errorLine(t, errors.accounts?.[index]?.url, MAX_URL_LENGTH)
            const errorId = `social-account-${index}-error`
            return (
              <li key={account.id} className="flex items-start gap-2">
                <RowCell error={error} errorId={errorId} className="flex-1">
                  <Input
                    type="url"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={t(`${S}.urlOf`, { number })}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : undefined}
                    placeholder={t(`${S}.placeholder`)}
                    {...form.register(`accounts.${index}.url`)}
                  />
                </RowCell>
                <RowActions
                  index={index}
                  count={accounts.fields.length}
                  item={t(`${S}.item`, { number })}
                  onMove={(to) => {
                    accounts.move(index, to)
                  }}
                  onRemove={() => {
                    accounts.remove(index)
                  }}
                />
              </li>
            )
          })}
        </ol>
      )}
      <ListFooter
        label={t(`${S}.add`)}
        hint={t(`${S}.hint`, { max: MAX_ACCOUNTS })}
        full={accounts.fields.length >= MAX_ACCOUNTS}
        onAdd={() => {
          accounts.append({ url: "" })
        }}
      />
    </CardForm>
  )
}
