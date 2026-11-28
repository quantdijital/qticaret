import { useTranslation } from "react-i18next"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import type { CustomerMessage, TextField } from "@/features/settings/api/customer-messages"
import {
  SMS_MAX_PARTS,
  TOKEN_KEYS,
  emptyableTokens,
  missingTokens,
  smsCount,
  unknownTokens,
  usesFreeText,
} from "@/features/settings/customer-messages"
import { TokenSlot } from "@/features/settings/components/shop-token-menu"
import type { ExtraToken } from "@/features/settings/components/shop-token-menu"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"

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

/** The SMS's length with each token at its longest, Netgsm's Turkish encoding counted. */
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
      ) : usesFreeText(text, message) ? (
        <p className="text-xs text-warning-text">{t(`${C}.smsUcs2Risk`)}</p>
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
  const missing = value.trim() === "" ? [] : missingTokens(value, message, field)
  const emptyable = emptyableTokens(value, message)
  const refused = unknown.length > 0 || missing.length > 0
  const multiline = MULTILINE.has(field)
  const hint = t(`${C}.fieldHints.${field}`, { defaultValue: "" })
  const described = [hint ? `${id}-hint` : null, refused ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ")
  // Left empty, the field takes the platform's words: they are its example
  const example = message.fields.find((each) => each.field === field)?.default
  const common = {
    id,
    value,
    disabled,
    maxLength: FIELD_LIMITS[field],
    className: "pr-9",
    "aria-invalid": refused ? true : undefined,
    "aria-describedby": described || undefined,
  }
  const named = (names: string[]) => names.map((name) => `{${name}}`).join(", ")
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
            placeholder={example}
            {...common}
            rows={field === "intro" ? 5 : 4}
            onChange={(event) => {
              onChange(event.target.value)
            }}
          />
        ) : (
          <Input
            placeholder={example}
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
      {refused ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive-text">
          {unknown.length > 0
            ? t(`${C}.unknownTokens`, { tokens: named(unknown) })
            : t(`${C}.missingTokens`, { tokens: named(missing) })}
        </p>
      ) : null}
      {emptyable.length > 0 ? (
        <p className="text-xs text-warning-text">
          {t(`${C}.mayBeEmpty`, { tokens: named(emptyable) })}
        </p>
      ) : null}
      {field === "sms" ? <SmsMeter text={value} message={message} /> : null}
    </div>
  )
}
