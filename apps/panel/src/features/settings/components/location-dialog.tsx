import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { Info, Loader2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useSaveLocation } from "@/features/settings/api/locations"
import type { Location, LocationInput } from "@/features/settings/api/locations"
import { provincesQuery } from "@/features/tr-address/api"
import { TrAddressFields } from "@/features/tr-address/address-fields"
import { postalCodeFits, trAddressShape } from "@/features/tr-address/schema"
import { errorText } from "@/lib/errors"

const name = z
  .string()
  .trim()
  .min(1, "settings.locations.form.nameRequired")
  .max(100, "settings.locations.form.nameTooLong")
const schema = z.object({ name, ...trAddressShape })
type LocationForm = z.infer<typeof schema>
// A warehouse abroad: the panel's address form is Turkish, so only its name is edited
const nameOnly = z.object({ name })

const valuesOf = (location: Location | null): LocationForm => ({
  name: location?.name ?? "",
  address_1: location?.address?.address_1 ?? "",
  address_2: location?.address?.address_2 ?? "",
  province: location?.address?.province ?? "",
  city: location?.address?.city ?? "",
  postal_code: location?.address?.postal_code ?? "",
  phone: location?.address?.phone ?? "",
})

const inputOf = (values: LocationForm, isForeign: boolean): LocationInput => {
  const optional = (value: string) => value || null
  return {
    name: values.name,
    ...(isForeign
      ? {}
      : {
          address: {
            address_1: values.address_1,
            address_2: optional(values.address_2),
            province: values.province,
            city: values.city,
            postal_code: optional(values.postal_code),
            phone: optional(values.phone),
            country_code: "tr",
          },
        }),
  }
}

function LocationFormBody({ location, onDone }: { location: Location | null; onDone: () => void }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const save = useSaveLocation()
  const [failure, setFailure] = useState<string | null>(null)
  const isForeign = Boolean(location?.address && location.address.country_code !== "tr")
  const form = useForm<LocationForm>({
    resolver: zodResolver(isForeign ? (nameOnly as unknown as typeof schema) : schema),
    defaultValues: valuesOf(location),
  })
  const { errors, isSubmitting } = form.formState
  const message = (key: string | undefined) => (key ? t(key) : undefined)
  const submit = form.handleSubmit(async (values) => {
    setFailure(null)
    try {
      if (!isForeign && !postalCodeFits(values, await client.query(provincesQuery()))) {
        form.setError("postal_code", { message: "address.errors.postalCodeProvince" })
        return
      }
      await save.mutateAsync({ id: location?.id, input: inputOf(values, isForeign) })
      toast.success(
        t(location ? "settings.locations.form.updated" : "settings.locations.form.created")
      )
      onDone()
    } catch (error) {
      setFailure(errorText(t, error))
    }
  })
  const isBusy = isSubmitting || save.isPending
  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(event) => {
        void submit(event)
      }}
    >
      <DialogBody>
        <Field
          label={t("settings.locations.form.name")}
          htmlFor="location-name"
          hint={t("settings.locations.form.nameHint")}
          error={message(errors.name?.message)}
          required
        >
          <Input id="location-name" autoComplete="off" maxLength={100} {...form.register("name")} />
        </Field>
        {isForeign ? (
          <p className="flex items-start gap-2 rounded-md bg-muted px-3 py-2.5 text-[13px] text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t("settings.locations.form.foreign")}
          </p>
        ) : (
          <TrAddressFields
            control={form.control}
            idPrefix="location"
            errors={{
              address_1: message(errors.address_1?.message),
              address_2: message(errors.address_2?.message),
              province: message(errors.province?.message),
              city: message(errors.city?.message),
              postal_code: message(errors.postal_code?.message),
              phone: message(errors.phone?.message),
            }}
          />
        )}
        {failure ? (
          <p role="alert" className="text-sm text-destructive-text">
            {failure}
          </p>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={isBusy}>
          {isBusy ? <Loader2 className="animate-spin" /> : null}
          {t("common.save")}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Adds a warehouse, or changes one's name and address. */
export function LocationDialog({
  open,
  onOpenChange,
  location,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The warehouse being changed; none adds one. */
  location: Location | null
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(location ? "settings.locations.form.editTitle" : "settings.locations.form.title")}
          </DialogTitle>
          <DialogDescription>{t("settings.locations.form.description")}</DialogDescription>
        </DialogHeader>
        {/* Mounted per opening, so a closed dialog forgets what was typed */}
        {open ? (
          <LocationFormBody
            location={location}
            onDone={() => {
              onOpenChange(false)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
