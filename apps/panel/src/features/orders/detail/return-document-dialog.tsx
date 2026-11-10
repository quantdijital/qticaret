import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useRecordReturnDocument, useUploadInvoicePdf } from "@/features/orders/api/invoices"
import type { InvoiceRecord } from "@/features/orders/api/invoices"
import { errorText } from "@/lib/errors"

const R = "orders.invoice.returns"

const schema = z.object({
  number: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9 ./-]{0,39}$/, `${R}.numberInvalid`),
  issued_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "orders.invoice.entry.dateInvalid"),
})
type Values = z.infer<typeof schema>

const today = () => new Date().toISOString().slice(0, 10)

/**
 * A return's document entered (F8 E6): the gider pusulası the shop filled
 * in, by its form's serial, or the return invoice a company sent, by its
 * number; then its PDF (a scan of the signed form). The PDF alone once
 * the number is in.
 */
export function ReturnDocumentDialog({
  record,
  onClose,
}: {
  record: InvoiceRecord
  onClose: () => void
}) {
  const { t } = useTranslation()
  const write = useRecordReturnDocument()
  const upload = useUploadInvoicePdf()
  const [file, setFile] = useState<File | null>(null)
  const numbered = record.status === "issued"
  const document = record.document_type === "return_invoice" ? "return_invoice" : "expense_voucher"
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { number: "", issued_on: today() },
  })
  const { errors } = form.formState
  const busy = write.isPending || upload.isPending
  const fail = (failure: unknown) => toast.error(errorText(t, failure))
  const finish = () => {
    toast.success(t(`${R}.saved`))
    onClose()
  }
  const sendPdf = () => {
    if (!file) {
      finish()
      return
    }
    upload.mutate({ id: record.id, file }, { onSuccess: finish, onError: fail })
  }
  const submit = numbered
    ? () => {
        sendPdf()
      }
    : form.handleSubmit((values) => {
        write.mutate(
          {
            id: record.id,
            number: values.number,
            issued_at: new Date(`${values.issued_on}T12:00:00`).toISOString(),
          },
          { onSuccess: sendPdf, onError: fail }
        )
      })
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`${R}.enterTitle.${document}`)}</DialogTitle>
          <DialogDescription>{t(`${R}.enterHint.${document}`)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {numbered ? null : (
            <>
              <Field
                label={t(`${R}.number.${document}`)}
                htmlFor="return-number"
                error={errors.number?.message ? t(errors.number.message) : undefined}
              >
                <Input id="return-number" autoComplete="off" {...form.register("number")} />
              </Field>
              <Field
                label={t("orders.invoice.entry.issuedOn")}
                htmlFor="return-date"
                error={errors.issued_on?.message ? t(errors.issued_on.message) : undefined}
              >
                <Input id="return-date" type="date" {...form.register("issued_on")} />
              </Field>
            </>
          )}
          <Field label={t(`${R}.pdf`)} htmlFor="return-pdf" className="sm:col-span-2">
            <Input
              id="return-pdf"
              type="file"
              accept="application/pdf"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
              }}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={busy || (numbered && !file)}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
