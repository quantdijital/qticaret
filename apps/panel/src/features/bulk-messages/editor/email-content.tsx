import { Controller, useWatch } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Input } from "@qticaret/admin-ui/ui/input"
import { RichEditor } from "@/features/content/editor/rich-editor"
import { LIMITS, productCardCount } from "@/features/bulk-messages/form"
import type { EditorValues } from "@/features/bulk-messages/form"
import { TokenSlot } from "@/features/settings/components/shop-token-menu"
import type { ExtraToken } from "@/features/settings/components/shop-token-menu"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { EmailAi } from "./email-ai"
import { useNameToken } from "./name-token"

const F = "bulkMessages.fields"

/** A document's error is the field's own: its parts carry none (JSONContent is open-ended). */
const messageOf = (error: unknown): string | undefined => {
  const message = (error as { message?: unknown } | undefined)?.message
  return typeof message === "string" ? message : undefined
}

function LineField({
  form,
  name,
  max,
  extra,
}: {
  form: UseFormReturn<EditorValues>
  name: "subject" | "preheader"
  max: number
  extra: ExtraToken[]
}) {
  const { t } = useTranslation()
  const value = useWatch({ control: form.control, name })
  const error = form.formState.errors[name]?.message
  const id = `bulk-${name}`
  return (
    <Field
      label={t(`${F}.${name}`)}
      htmlFor={id}
      hint={`${t(`${F}.${name}Hint`)} ${t(`${F}.chars`, { used: formatCount(value.length), max: formatCount(max) })}`}
      error={error ? t(error, { limit: formatCount(max) }) : undefined}
      required={name === "subject"}
    >
      <TokenSlot
        fieldId={id}
        extra={extra}
        onInsert={(text) => {
          form.setValue(name, text, { shouldDirty: true, shouldValidate: true })
        }}
      >
        <Input
          id={id}
          maxLength={max}
          className="pr-9"
          aria-invalid={error ? true : undefined}
          {...form.register(name)}
        />
      </TokenSlot>
    </Field>
  )
}

/**
 * An e-mail (adr/0050 §4): its subject (120), the preview line the inbox
 * shows after it, and a body written as a page is, the server drawing it
 * as e-mail: headings, paragraphs, lists, links, buttons, the media
 * library's images and up to four product cards. "Yapay zekâ ile öner"
 * beside the subject offers its words (adr/0074 §5 madde 6).
 */
export function EmailContent({
  form,
  ai,
}: {
  form: UseFormReturn<EditorValues>
  /** The saved campaign the words are asked for; none: no "Yapay zekâ ile öner". */
  ai?: { campaignId: string; dirty: boolean } | null | undefined
}) {
  const { t } = useTranslation()
  const extra = useNameToken()
  const body = useWatch({ control: form.control, name: "body" })
  const cards = productCardCount(body)
  const bodyError = messageOf(form.formState.errors.body)
  return (
    <SectionCard
      title={t("bulkMessages.content.emailTitle")}
      description={t("bulkMessages.content.emailHint")}
      action={ai ? <EmailAi form={form} campaignId={ai.campaignId} dirty={ai.dirty} /> : undefined}
    >
      <div className="flex flex-col gap-5">
        <div className="grid items-start gap-5 md:grid-cols-2">
          <LineField form={form} name="subject" max={LIMITS.subject} extra={extra} />
          <LineField form={form} name="preheader" max={LIMITS.preheader} extra={extra} />
        </div>
        <div className="flex flex-col gap-2">
          <span id="bulk-body-label" className="text-sm font-medium">
            {t(`${F}.body`)}
            <span className="ml-0.5 text-destructive-text">*</span>
          </span>
          <div>
            <Controller
              control={form.control}
              name="body"
              render={({ field }) => (
                <RichEditor
                  value={field.value}
                  onChange={field.onChange}
                  label={t(`${F}.body`)}
                  shopTokens
                  extraTokens={extra}
                />
              )}
            />
          </div>
          {bodyError ? (
            <p role="alert" className="text-xs text-destructive-text">
              {t(bodyError, { max: LIMITS.productCards })}
            </p>
          ) : (
            <p
              className={cn(
                "text-xs text-muted-foreground",
                cards > LIMITS.productCards && "text-destructive-text"
              )}
            >
              {t(`${F}.bodyHint`, { count: cards, max: LIMITS.productCards })}
            </p>
          )}
        </div>
      </div>
    </SectionCard>
  )
}
