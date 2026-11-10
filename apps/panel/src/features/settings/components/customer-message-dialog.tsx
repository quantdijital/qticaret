import { Link } from "@tanstack/react-router"
import { Info, RotateCcw } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Alert, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@qticaret/admin-ui/ui/tabs"
import { useCan } from "@/features/auth/api/staff"
import { useSaveCustomerMessage } from "@/features/settings/api/customer-messages"
import type { CustomerMessage } from "@/features/settings/api/customer-messages"
import {
  SMS_MAX_PARTS,
  bodyOf,
  defaultsOf,
  draftOf,
  fieldsOf,
  smsCount,
  missingTokens,
  unknownTokens,
  valuesOf,
} from "@/features/settings/customer-messages"
import type { TextValues } from "@/features/settings/customer-messages"
import { errorText } from "@/lib/errors"
import { MessageTextField } from "./customer-message-fields"
import { CustomerMessagePreview } from "./customer-message-preview"

const C = "settings.notifications.customer"
const NAMES = "settings.notifications.templates.names"
const TAB_BODY = "flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"

/** Whether it goes: a switch here, "zorunlu" with why, or where its feature turns it on. */
function SendSwitch({
  message,
  enabled,
  onChange,
  disabled,
}: {
  message: CustomerMessage
  enabled: boolean
  onChange: (enabled: boolean) => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  if (message.switch === "here") {
    return (
      <div className="flex min-h-11 items-center justify-between gap-4 rounded-md border px-4 py-2">
        <label htmlFor="customer-message-enabled" className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{t(`${C}.send`)}</span>
          <span className="text-xs text-muted-foreground">{t(`${C}.sendHint`)}</span>
        </label>
        <Switch
          id="customer-message-enabled"
          checked={enabled}
          disabled={disabled}
          onCheckedChange={onChange}
        />
      </div>
    )
  }
  return (
    <Alert>
      <Info aria-hidden="true" />
      <AlertDescription className="flex flex-col items-start gap-1">
        {message.switch === "required" ? (
          <p>
            {t(`${C}.requiredHint.${message.name}`, {
              defaultValue: t(`${C}.requiredHint.default`),
            })}
          </p>
        ) : (
          <>
            <p>{t(enabled ? `${C}.marketingOn` : `${C}.marketingOff`)}</p>
            <Link
              to="/settings/marketing"
              search={{ part: "carts" }}
              className="font-medium text-primary-text underline underline-offset-4"
            >
              {t(`${C}.marketingLink`)}
            </Link>
          </>
        )}
      </AlertDescription>
    </Alert>
  )
}

/**
 * One customer message's words and switch (adr/0036 Ek 2026-11-10), in
 * the standard dialog: the e-mail's and the SMS's texts in their tabs,
 * each beside the message as it would read, "Varsayılana dön" to put the
 * platform's words back. Owner and admin change them; others read.
 */
export function CustomerMessageDialog({
  message,
  onClose,
}: {
  message: CustomerMessage
  onClose: () => void
}) {
  const { t } = useTranslation()
  const editable = useCan("settings")
  const save = useSaveCustomerMessage(message.name)
  const [values, setValues] = useState<TextValues>(() => valuesOf(message))
  const [enabled, setEnabled] = useState(message.enabled)
  const [tab, setTab] = useState<"email" | "sms">(message.channels[0] ?? "email")
  const body = bodyOf(message, values, enabled)
  const dirty = Object.keys(body).length > 0
  const typed = Object.values(values).join("\n")
  const sms = values.sms ?? ""
  const valid =
    unknownTokens(typed, message).length === 0 &&
    // A field left empty takes the platform's text, which keeps what it must
    message.fields.every((field) => {
      const text = values[field.field] ?? ""
      return text.trim() === "" || missingTokens(text, message, field.field).length === 0
    }) &&
    (message.fields.every((field) => field.field !== "sms") ||
      smsCount(sms, message).parts <= SMS_MAX_PARTS)
  const defaults = defaultsOf(message)
  const atDefaults = message.fields.every(
    (field) => (values[field.field] ?? "").trim() === field.default.trim()
  )
  const channels = message.channels.filter((channel) => fieldsOf(message, channel).length > 0)
  const set = (field: keyof TextValues) => (text: string) => {
    setValues((current) => ({ ...current, [field]: text }))
  }

  const fields = (channel: "email" | "sms") => (
    <div className="grid min-w-0 gap-6 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-5">
        {fieldsOf(message, channel).map((field) => (
          <MessageTextField
            key={field}
            message={message}
            field={field}
            value={values[field] ?? ""}
            onChange={set(field)}
            disabled={!editable || save.isPending}
          />
        ))}
      </div>
      <CustomerMessagePreview
        message={message}
        draft={draftOf(message, values)}
        editable={editable}
        valid={valid}
        channel={channel}
      />
    </div>
  )

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      size="xl"
      pane="fixed"
      title={t(`${NAMES}.${message.name}`)}
      description={t(`${C}.kind.${message.kind}`)}
      dirty={dirty}
      saving={save.isPending}
      canSubmit={editable && valid}
      onSubmit={() => {
        save.mutate(body, {
          onSuccess: () => {
            toast.success(t(`${C}.saved`))
            onClose()
          },
        })
      }}
      footerStart={
        editable && message.fields.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            disabled={atDefaults || save.isPending}
            onClick={() => {
              setValues(defaults)
            }}
          >
            <RotateCcw />
            {t(`${C}.reset`)}
          </Button>
        ) : null
      }
    >
      <div className="flex shrink-0 flex-col gap-3">
        <SendSwitch
          message={message}
          enabled={enabled}
          onChange={setEnabled}
          disabled={!editable || save.isPending}
        />
        {save.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{errorText(t, save.error)}</AlertDescription>
          </Alert>
        ) : null}
      </div>
      {channels.length === 0 ? (
        <DialogBody>
          <p className="text-sm text-muted-foreground">{t(`${C}.fixedText`)}</p>
          <CustomerMessagePreview
            message={message}
            draft={{}}
            editable={false}
            valid
            channel="email"
          />
        </DialogBody>
      ) : (
        <Tabs
          value={tab}
          onValueChange={(next) => {
            setTab(next as "email" | "sms")
          }}
          className="flex min-h-0 flex-1 flex-col gap-5"
        >
          <TabsList className="w-full shrink-0 sm:w-fit">
            {channels.map((channel) => (
              <TabsTrigger key={channel} value={channel}>
                {t(`${C}.channels.${channel}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          {channels.map((channel) => (
            <TabsContent key={channel} value={channel} forceMount className={TAB_BODY}>
              <DialogBody>{fields(channel)}</DialogBody>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </FormDialog>
  )
}
