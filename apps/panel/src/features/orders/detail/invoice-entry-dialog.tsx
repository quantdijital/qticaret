import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUploadInvoicePdf, useWriteBackInvoice } from "@/features/orders/api/invoices"
import { errorText } from "@/lib/errors"

const I = "orders.invoice.entry"
const TYPES = ["e_archive", "e_invoice"] as const

const schema = z.object({
  number: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3}20\d{2}\d{9}$/, `${I}.numberInvalid`),
  uuid: z
    .string()
    .trim()
    .refine(
      (text) => text === "" || /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(text),
      `${I}.uuidInvalid`
    ),
  document_type: z.enum(TYPES),
  issued_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${I}.dateInvalid`),
})
type Values = z.infer<typeof schema>

const today = () => new Date().toISOString().slice(0, 10)

/**
 * An invoice issued outside the panel (the shop's own program, Luca by
 * hand), typed in (adr/0034 §9): its number, ETTN, kind and day, then
 * its PDF. A number already given is refused by the server.
 */
export function InvoiceEntryDialog({
  invoiceId,
  numbered,
  onClose,
}: {
  invoiceId: string
  /** The number is in already: only the PDF is asked. */
  numbered: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const write = useWriteBackInvoice()
  const upload = useUploadInvoicePdf()
  const [file, setFile] = useState<File | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { number: "", uuid: "", document_type: "e_archive", issued_on: today() },
  })
  const { errors } = form.formState
  const message = (key?: string) => (key ? t(key) : undefined)
  const busy = write.isPending || upload.isPending
  const fail = (failure: unknown) => toast.error(errorText(t, failure))
  const sendPdf = () => {
    if (!file) {
      onClose()
      return
    }
    upload.mutate(
      { id: invoiceId, file },
      {
        onSuccess: () => {
          toast.success(t(`${I}.saved`))
          onClose()
        },
        onError: fail,
      }
    )
  }
  const submit = numbered
    ? () => {
        sendPdf()
      }
    : form.handleSubmit((values) => {
        write.mutate(
          {
            id: invoiceId,
            issued: {
              number: values.number,
              uuid: values.uuid || null,
              document_type: values.document_type,
              issued_at: new Date(`${values.issued_on}T12:00:00`).toISOString(),
            },
          },
          {
            onSuccess: () => {
              if (!file) {
                toast.success(t(`${I}.saved`))
              }
              sendPdf()
            },
            onError: fail,
          }
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
          <DialogTitle>{t(numbered ? `${I}.pdfTitle` : `${I}.title`)}</DialogTitle>
          <DialogDescription>{t(`${I}.description`)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {numbered ? null : (
            <>
              <Field
                label={t(`${I}.number`)}
                htmlFor="invoice-number"
                error={message(errors.number?.message)}
              >
                <Input id="invoice-number" autoComplete="off" {...form.register("number")} />
              </Field>
              <Field
                label={t(`${I}.issuedOn`)}
                htmlFor="invoice-date"
                error={message(errors.issued_on?.message)}
              >
                <Input id="invoice-date" type="date" {...form.register("issued_on")} />
              </Field>
              <Field label={t(`${I}.type`)} htmlFor="invoice-type">
                <Controller
                  control={form.control}
                  name="document_type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="invoice-type" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(`orders.invoice.types.${type}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field
                label={t(`${I}.uuid`)}
                htmlFor="invoice-uuid"
                error={message(errors.uuid?.message)}
              >
                <Input id="invoice-uuid" autoComplete="off" {...form.register("uuid")} />
              </Field>
            </>
          )}
          <Field label={t(`${I}.pdf`)} htmlFor="invoice-pdf" className="sm:col-span-2">
            <Input
              id="invoice-pdf"
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
