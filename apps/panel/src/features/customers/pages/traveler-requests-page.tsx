import { zodResolver } from "@hookform/resolvers/zod"
import { Search } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { EmptyState, ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useCan } from "@/features/auth/api/staff"
import { useFindTravelers } from "@/features/customers/api/traveler-requests"
import type { TravelerSearch } from "@/features/customers/api/traveler-requests"
import { EMPTY_SEARCH, searchOf, searchSchema } from "@/features/customers/traveler-search"
import type { SearchDraft } from "@/features/customers/traveler-search"
import { CustomersNav } from "@/features/customers/components/customers-nav"
import { TravelerRequestResults } from "@/features/customers/components/traveler-request-results"
import { BOOKING_FLAG } from "@/features/products/api/booking"
import { useFeature } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"

const R = "customers.travelerRequests"

/**
 * `/customers/travelers` (adr/0076 Ek D6b): a traveler's own KVKK request.
 * The person named in a booking is not the buyer and has no account; staff
 * find their rows by the name, and the birth date or the ID number when
 * the product asked them, hand over a copy (the number masked) and delete
 * them on request. Owner and admin; the dated sales flag on.
 */
export function TravelerRequestsPage() {
  const { t } = useTranslation()
  const allowed = useCan("travelerRequests")
  const flagOn = useFeature(BOOKING_FLAG)
  const find = useFindTravelers()
  const [asked, setAsked] = useState<TravelerSearch | null>(null)
  const form = useForm<SearchDraft>({
    resolver: zodResolver(searchSchema),
    defaultValues: EMPTY_SEARCH,
  })
  const { errors } = form.formState
  const errorOf = (message: string | undefined) => (message ? t(message) : undefined)
  const submit = form.handleSubmit((draft) => {
    const search = searchOf(draft)
    setAsked(search)
    find.mutate(search)
  })
  const text = (name: keyof SearchDraft, type = "text", hint?: string) => (
    <Field
      label={t(`${R}.fields.${name}`)}
      htmlFor={`traveler-${name}`}
      required={name === "first_name" || name === "last_name"}
      error={errorOf(errors[name]?.message)}
      {...(hint ? { hint } : {})}
    >
      <Input
        id={`traveler-${name}`}
        type={type}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={Boolean(errors[name])}
        {...form.register(name)}
      />
    </Field>
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${R}.title`)} description={t(`${R}.description`)} />
      <CustomersNav />
      {!allowed || !flagOn ? (
        <EmptyState text={t(allowed ? `${R}.flagOff` : `${R}.notAllowed`)} />
      ) : (
        <>
          <form
            className="flex flex-col gap-4 rounded-lg border bg-card p-5 shadow-card"
            noValidate
            onSubmit={(event) => {
              void submit(event)
            }}
          >
            <p className="text-[13px] text-muted-foreground">{t(`${R}.hint`)}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {text("first_name")}
              {text("last_name")}
              {text("birth_date", "date", t(`${R}.fields.birthDateHint`))}
              {text("document_no", "text", t(`${R}.fields.documentHint`))}
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={find.isPending}>
                <Search />
                {t(`${R}.search`)}
              </Button>
            </div>
          </form>
          {find.isError ? <ErrorState text={errorText(t, find.error)} /> : null}
          {find.isSuccess && asked ? (
            <TravelerRequestResults
              key={JSON.stringify(asked)}
              rows={find.data}
              onErased={() => {
                find.mutate(asked)
              }}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
