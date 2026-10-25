import { Badge, Input, Label, Text, Textarea } from "@medusajs/ui"
import { useTranslation } from "react-i18next"
import { SEO_TEMPLATE_TOKENS, fitsSerp, renderTemplate } from "../../../../lib/seo"
import type { SerpField } from "../../../../lib/seo"

type Entity = keyof typeof SEO_TEMPLATE_TOKENS

interface TemplateFieldProps {
  id: string
  label: string
  entity: Entity
  serpField: SerpField
  value: string
  error?: string | undefined
  multiline?: boolean
  onChange: (value: string) => void
  onBlur: () => void
}

/**
 * A title or description template with the tokens it may use, a preview
 * filled with sample values, and whether the result fits a Google result
 * (docs/13 §3, a warning only).
 */
export function TemplateField(props: TemplateFieldProps) {
  const { t } = useTranslation()
  const { id, label, entity, serpField, value, error, multiline, onChange, onBlur } = props
  const samples: Record<string, string> = Object.fromEntries(
    SEO_TEMPLATE_TOKENS[entity].map((token) => [
      token,
      t(`qticaret.settings.seo.samples.${token}`, { defaultValue: token }),
    ])
  )
  const preview = error ? "" : renderTemplate(value, samples)
  const Field = multiline ? Textarea : Input

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} size="small" weight="plus">
        {label}
      </Label>
      <Field
        id={id}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-help`}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        onBlur={onBlur}
      />
      <div id={`${id}-help`} className="flex flex-col gap-1">
        <Text size="xsmall" className="text-ui-fg-subtle">
          {t("qticaret.settings.seo.templates.tokens")}{" "}
          {SEO_TEMPLATE_TOKENS[entity].map((token) => `{${token}}`).join(" ")}
        </Text>
        {error ? (
          <Text size="xsmall" className="text-ui-fg-error">
            {t(error)}
          </Text>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Text size="xsmall" className="text-ui-fg-subtle">
              {t("qticaret.settings.seo.templates.preview")} {preview}
            </Text>
            <Badge size="2xsmall" color={fitsSerp(serpField, preview) ? "green" : "orange"}>
              {fitsSerp(serpField, preview)
                ? t("qticaret.settings.seo.templates.fits")
                : t("qticaret.settings.seo.templates.tooLong")}
            </Badge>
          </div>
        )}
      </div>
    </div>
  )
}
