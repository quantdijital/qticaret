import { useQuery } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { InventorySettings, OutOfStockListing } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"

const O = "settings.outOfStock"
const CHOICES: readonly OutOfStockListing[] = ["show", "hide"]

interface Values {
  out_of_stock_listing: OutOfStockListing
}

function Form({ saved }: { saved: Values }) {
  const { t } = useTranslation()
  const save = useSaveSection<InventorySettings>("inventory")
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })
  const submit = form.handleSubmit((next) => {
    save.mutate(next, {
      onSuccess: () => {
        form.reset(next, FULL_RESET)
        toast.success(t("settings.saved"))
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  })
  return (
    <CardForm
      title={t(`${O}.title`)}
      description={t(`${O}.description`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved, FULL_RESET)
      }}
    >
      <Controller
        control={form.control}
        name="out_of_stock_listing"
        render={({ field }) => (
          <RadioGroup
            aria-label={t(`${O}.title`)}
            value={field.value}
            onValueChange={(value) => {
              field.onChange(value)
            }}
            className="gap-2"
          >
            {CHOICES.map((choice) => (
              <label
                key={choice}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm has-[[data-state=checked]]:border-primary"
              >
                <RadioGroupItem value={choice} className="mt-0.5" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">{t(`${O}.choices.${choice}`)}</span>
                  <span className="text-[13px] text-muted-foreground">
                    {t(`${O}.hints.${choice}`)}
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>
        )}
      />
    </CardForm>
  )
}

/**
 * "Stokta olmayan ürünler" (T1; WooCommerce's "Hide out of stock items
 * from the catalog"): shown in listings as before (default), or left out
 * of category, campaign and catalogue listings, site search and the
 * categories' counts. Their page stays reachable and in the sitemap; a
 * product whose stock is not tracked is always in stock.
 */
export function OutOfStockCard() {
  const query = useQuery(sectionQuery<InventorySettings>("inventory"))
  // An answer without values (a failed or odd read) waits as loading, never breaks the page
  const values = (query.data as { values?: InventorySettings } | undefined)?.values
  if (!values) {
    return <Skeleton className="h-40 rounded-lg" />
  }
  return <Form saved={{ out_of_stock_listing: values.out_of_stock_listing ?? "show" }} />
}
