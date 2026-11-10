import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import type { FieldErrors } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { LeaveGuard } from "@qticaret/admin-ui/patterns/leave-guard"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { LineTabs } from "@/features/bulk-messages/components/line-tabs"
import type { LineTab } from "@/features/bulk-messages/components/line-tabs"
import { useCreatePaymentLink } from "@/features/payment-links/api/payment-links"
import { linkFormSchema } from "@/features/payment-links/form"
import type { LinkFormValues } from "@/features/payment-links/form"
import { requestOf } from "@/features/payment-links/request"
import { errorText } from "@/lib/errors"
import { isReauthCancelled } from "@/lib/reauth"
import { CustomerCard } from "./customer-card"
import { DeliveryTab } from "./delivery-tab"
import { DiscountTab } from "./discount-tab"
import { LinesCard } from "./lines-card"
import { NoteTab } from "./note-tab"
import { SummaryCard } from "./summary-card"
import { useLinkPreview } from "./use-link-preview"

const F = "paymentLinks.form"

type Tab = "delivery" | "discount" | "note"

/** The tab a refused field sits on, so a failed submit shows why. */
function tabOf(errors: FieldErrors<LinkFormValues>): Tab | null {
  if (
    errors.recipient_first ||
    errors.recipient_last ||
    errors.address_1 ||
    errors.address_2 ||
    errors.province ||
    errors.city ||
    errors.postal_code ||
    errors.phone
  ) {
    return "delivery"
  }
  if (errors.discountValue || errors.discountReason) {
    return "discount"
  }
  return errors.hours || errors.note ? "note" : null
}

/**
 * The new order (adr/0051 §13): the customer and the lines on top, the
 * optional parts (delivery, discount, note and how long it opens) in tabs;
 * beside them the backend's summary and "Bağlantı oluştur". Made, the
 * link's page opens on its share card.
 */
export function LinkForm({
  defaults,
  canDiscount,
}: {
  defaults: LinkFormValues
  canDiscount: boolean
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const create = useCreatePaymentLink()
  const [tab, setTab] = useState<Tab>("delivery")
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<LinkFormValues>({
    resolver: zodResolver(linkFormSchema),
    defaultValues: defaults,
  })
  const preview = useLinkPreview(form.control, canDiscount)
  const short = new Set(preview.query.data?.short_variant_ids ?? [])
  const submit = form.handleSubmit(
    (values) => {
      setFailure(null)
      create.mutate(requestOf(values, canDiscount), {
        onSuccess: (made) => {
          void navigate({
            to: "/payment-links/$id",
            params: { id: made.payment_link.id },
            search: { created: true },
            ignoreBlocker: true,
          })
        },
        onError: (error) => {
          // Closing the proof dialog is no failure: the form stays as it was
          if (!isReauthCancelled(error)) {
            setFailure(errorText(t, error))
          }
        },
      })
    },
    (errors) => {
      const where = tabOf(errors)
      if (where) {
        setTab(where)
      }
      setFailure(t(`${F}.invalid`))
    }
  )
  const tabs: LineTab<Tab>[] = [
    { key: "delivery", label: t(`${F}.tabs.delivery`), content: <DeliveryTab /> },
    ...(canDiscount
      ? [{ key: "discount" as const, label: t(`${F}.tabs.discount`), content: <DiscountTab /> }]
      : []),
    { key: "note", label: t(`${F}.tabs.note`), content: <NoteTab /> },
  ]
  return (
    <FormProvider {...form}>
      <LeaveGuard when={form.formState.isDirty && !create.isPending && !create.isSuccess} />
      <form
        noValidate
        onSubmit={(event) => {
          void submit(event)
        }}
      >
        <PageGrid>
          <PageColumn span={8}>
            <CustomerCard />
            <LinesCard short={short} />
            <LineTabs label={t(`${F}.parts`)} value={tab} onChange={setTab} tabs={tabs} />
          </PageColumn>
          <PageColumn span={4} sticky>
            <SummaryCard state={preview} busy={create.isPending} failure={failure} />
          </PageColumn>
        </PageGrid>
      </form>
    </FormProvider>
  )
}
