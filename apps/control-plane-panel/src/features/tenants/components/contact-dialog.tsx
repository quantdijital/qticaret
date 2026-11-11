import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { RecordStepper } from "@qticaret/admin-ui/patterns/record-stepper"
import type { RecordSteps } from "@qticaret/admin-ui/patterns/record-stepper"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { formatPhone } from "@qticaret/admin-ui/lib/format"
import type { Contact, ContactRole } from "@/features/tenants/api"
import { useRemoveContact, useSaveContact } from "@/features/tenants/mutations"
import type { ContactInput } from "@/features/tenants/mutations"
import { errorText } from "@/lib/errors"

const ROLES = ["owner", "billing", "technical"] as const
const EMAIL = z.email()

const blank: ContactInput = {
  name: "",
  role: "owner",
  email: "",
  phone: "",
  is_primary_billing: false,
}

const inputOf = (contact: Contact | null): ContactInput =>
  contact
    ? {
        name: contact.name,
        role: contact.role,
        email: contact.email,
        phone: contact.phone ? formatPhone(contact.phone) : "",
        is_primary_billing: contact.is_primary_billing,
      }
    : blank

/**
 * A contact in one dialog (docs/18 §7), opened from the list or "Yetkili
 * ekle": name, role, e-mail, phone (written as people write it; the
 * control plane keeps E.164) and whether the payment reminders go to
 * them. "Yetkiliyi sil" removes them for good, after asking. A role that
 * reads only gets no dialog to change anything: the list says it all.
 */
export function ContactDialog({
  tenantId,
  contact,
  open,
  steps,
  readOnly,
  onClose,
}: {
  tenantId: string
  contact: Contact | null
  open: boolean
  steps: RecordSteps | null
  readOnly: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const save = useSaveContact(tenantId)
  const remove = useRemoveContact(tenantId)
  const [shown, setShown] = useState<string | null>(contact?.id ?? null)
  const [fields, setFields] = useState<ContactInput>(() => inputOf(contact))
  const [asking, setAsking] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  // Another record (‹ n / m ›) or a new one: the form starts from it
  if ((contact?.id ?? null) !== shown) {
    setShown(contact?.id ?? null)
    setFields(inputOf(contact))
    setFailure(null)
  }
  const initial = inputOf(contact)
  const dirty = (Object.keys(fields) as (keyof ContactInput)[]).some(
    (key) => fields[key] !== initial[key]
  )
  const guard = useDiscardGuard(dirty)
  const valid = fields.name.trim() !== "" && EMAIL.safeParse(fields.email.trim()).success
  const set = <K extends keyof ContactInput>(key: K, value: ContactInput[K]) => {
    setFields((current) => ({ ...current, [key]: value }))
  }
  if (readOnly || !open) {
    return null
  }
  const fail = (error: unknown) => {
    setFailure(errorText(t, error))
  }
  // Closed: the next opening starts from the record again, whatever was typed
  const finish = () => {
    setShown("")
    onClose()
  }
  const text = (key: "name" | "email" | "phone", type = "text") => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`contact-${key}`}>{t(`contacts.columns.${key}`)}</Label>
      <Input
        id={`contact-${key}`}
        type={type}
        autoComplete="off"
        value={fields[key]}
        onChange={(event) => {
          set(key, event.target.value)
        }}
      />
    </div>
  )
  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            finish()
          }
        }}
        title={contact ? contact.name : t("contacts.add")}
        description={t("contacts.dialogText")}
        guard={guard}
        headerAction={
          steps ? (
            <RecordStepper
              {...steps}
              onGo={(index) => {
                guard.guard(() => {
                  steps.onGo(index)
                })
              }}
              previousLabel={t("contacts.previous")}
              nextLabel={t("contacts.next")}
            />
          ) : undefined
        }
        dirty={dirty}
        saving={save.isPending}
        canSubmit={valid}
        footerStart={
          contact ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                setAsking(true)
              }}
            >
              {t("contacts.remove")}
            </Button>
          ) : undefined
        }
        onSubmit={() => {
          setFailure(null)
          save.mutate(
            {
              ...fields,
              name: fields.name.trim(),
              email: fields.email.trim(),
              contactId: contact?.id ?? null,
            },
            {
              onSuccess: () => {
                toast.success(t("contacts.saved"))
                finish()
              },
              onError: fail,
            }
          )
        }}
      >
        <DialogBody>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("name")}
            {text("email", "email")}
            {text("phone", "tel")}
          </div>
          <div className="flex flex-col gap-3">
            <p id="contact-role-label" className="text-sm font-medium">
              {t("contacts.columns.role")}
            </p>
            <RadioGroup
              aria-labelledby="contact-role-label"
              value={fields.role}
              onValueChange={(next) => {
                set("role", next as ContactRole)
              }}
              className="flex flex-wrap gap-6"
            >
              {ROLES.map((role) => (
                <div key={role} className="flex items-center gap-2">
                  <RadioGroupItem id={`contact-role-${role}`} value={role} />
                  <Label htmlFor={`contact-role-${role}`} className="font-normal">
                    {t(`contacts.roles.${role}`)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="contact-billing"
              checked={fields.is_primary_billing}
              onCheckedChange={(checked) => {
                set("is_primary_billing", checked === true)
              }}
            />
            <Label
              htmlFor="contact-billing"
              className="flex flex-col items-start gap-0.5 font-normal"
            >
              <span className="text-sm font-medium">{t("contacts.primary")}</span>
              <span className="text-[13px] text-muted-foreground">{t("contacts.primaryText")}</span>
            </Label>
          </div>
          {failure ? (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          ) : null}
        </DialogBody>
      </FormDialog>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t("contacts.confirm.title")}
        description={t("contacts.confirm.text", { name: contact?.name ?? "" })}
        confirmLabel={t("contacts.confirm.action")}
        destructive
        onConfirm={() => {
          if (contact) {
            remove.mutate(contact.id, {
              onSuccess: () => {
                toast.success(t("contacts.removed"))
                finish()
              },
              onError: (error) => toast.error(errorText(t, error)),
            })
          }
        }}
      />
    </>
  )
}
