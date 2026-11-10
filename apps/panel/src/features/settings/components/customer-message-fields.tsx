import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { CustomerMessage, TextField } from "@/features/settings/api/customer-messages"
import {
  SMS_MAX_PARTS,
  TOKEN_KEYS,
  smsCount,
  unknownTokens,
} from "@/features/settings/customer-messages"
import { TokenSlot } from "@/features/settings/components/shop-token-menu"
import type { ExtraToken } from "@/features/settings/components/shop-token-menu"
import { formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"

const C = "settings.notifications.customer"

/** How long each field may be; the server holds the same. */
const FIELD_LIMITS: Readonly<Record<TextField, number>> = {
  subject: 150,
  preheader: 150,
  heading: 150,
  intro: 2000,
  sms: 600,
}

const MULTILINE: ReadonlySet<TextField> = new Set(["intro", "sms"])

const fieldId = (field: TextField) => `customer-message-${field}`

/** The message's own `{belirteç}`s for the token menu, each with its preview value. */
function useMessageTokens(message: CustomerMessage): ExtraToken[] {
  const { t } = useTranslation()
  return message.tokens.map((token) => ({
    name: token.name,
    label: t(`${C}.tokens.${TOKEN_KEYS[token.name] ?? "other"}`, { defaultValue: token.name }),
    hint: t(`${C}.tokenSample`, { sample: token.sample || "—" }),
  }))
}

/** The SMS's length with the preview's values, Netgsm's Turkish encoding counted. */
export function SmsMeter({ text, message }: { text: string; message: CustomerMessage }) {
  const { t } = useTranslation()
  const length = smsCount(text, message)
  const tone =
    length.parts > SMS_MAX_PARTS
      ? "text-destructive-text"
      : length.parts > 1
        ? "text-warning-text"
        : "text-muted-foreground"
  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      <p className={cn("text-xs tabular-nums", tone)}>
        {t(`${C}.smsCount`, {
          chars: formatCount(length.units),
          parts: length.parts,
          perPart: length.encoding === "ucs2" ? 70 : 155,
        })}
      </p>
      {length.parts > SMS_MAX_PARTS ? (
        <p className="text-xs text-destructive-text">
          {t(`${C}.smsTooLong`, { max: SMS_MAX_PARTS })}
        </p>
      ) : length.parts > 1 ? (
        <p className="text-xs text-warning-text">{t(`${C}.smsLong`, { parts: length.parts })}</p>
      ) : null}
      {length.encoding === "ucs2" ? (
        <p className="text-xs text-warning-text">{t(`${C}.smsUcs2`)}</p>
      ) : null}
    </div>
  )
}

/**
 * One of the message's texts: plain words, the message's own
 * `{belirteç}`s from the menu at the field's edge, an unknown one named
 * under it. One line for the subject, the preview line and the title.
 */
export function MessageTextField({
  message,
  field,
  value,
  onChange,
  disabled,
}: {
  message: CustomerMessage
  field: TextField
  value: string
  onChange: (text: string) => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  const tokens = useMessageTokens(message)
  const id = fieldId(field)
  const unknown = unknownTokens(value, message)
  const multiline = MULTILINE.has(field)
  const hint = t(`${C}.fieldHints.${field}`, { defaultValue: "" })
  const described = [hint ? `${id}-hint` : null, unknown.length > 0 ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ")
  const common = {
    id,
    value,
    disabled,
    maxLength: FIELD_LIMITS[field],
    className: "pr-9",
    "aria-invalid": unknown.length > 0 ? true : undefined,
    "aria-describedby": described || undefined,
  }
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {t(`${C}.fields.${field}`)}
      </label>
      <TokenSlot
        fieldId={id}
        multiline={multiline}
        extra={tokens}
        shopDetails={false}
        onInsert={onChange}
      >
        {multiline ? (
          <Textarea
            {...common}
            rows={field === "intro" ? 5 : 4}
            onChange={(event) => {
              onChange(event.target.value)
            }}
          />
        ) : (
          <Input
            {...common}
            onChange={(event) => {
              onChange(event.target.value.replace(/[\r\n]+/g, " "))
            }}
          />
        )}
      </TokenSlot>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {unknown.length > 0 ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive-text">
          {t(`${C}.unknownTokens`, {
            tokens: unknown.map((name) => `{${name}}`).join(", "),
          })}
        </p>
      ) : null}
      {field === "sms" ? <SmsMeter text={value} message={message} /> : null}
    </div>
  )
}
