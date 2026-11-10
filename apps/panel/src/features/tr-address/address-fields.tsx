import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { useController } from "react-hook-form"
import type { Control, FieldValues, Path } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { districtsQuery, provincesQuery } from "./api"
import { sameName } from "./schema"

/** A Turkish address as Medusa stores it (F1.4): il in `province`, ilçe in `city`, mahalle in `address_2`. */
export interface TrAddressValues {
  address_1: string
  address_2: string
  province: string
  city: string
  postal_code: string
  phone: string
}

type Errors = Partial<Record<keyof TrAddressValues, string | undefined>>

/**
 * Province and district picked from the reference data, so they always
 * agree; the rest typed. A form's values hold these fields at their top
 * level. A stored name spelled otherwise ("istanbul") is matched and put
 * as the reference data writes it.
 */
export function TrAddressFields<T extends FieldValues & TrAddressValues>({
  control,
  errors,
  idPrefix,
}: {
  control: Control<T>
  errors: Errors
  idPrefix: string
}) {
  const { t } = useTranslation()
  const name = (key: keyof TrAddressValues) => key as Path<T>
  const province = useController({ control, name: name("province") })
  const city = useController({ control, name: name("city") })
  const neighborhood = useController({ control, name: name("address_2") })
  const address = useController({ control, name: name("address_1") })
  const postal = useController({ control, name: name("postal_code") })
  const phone = useController({ control, name: name("phone") })
  const provinces = useQuery(provincesQuery())
  const provinceValue = province.field.value as string
  const cityValue = city.field.value as string
  const match = provinces.data?.find((each) => sameName(each.name, provinceValue))
  const districts = useQuery(districtsQuery(match?.code ?? null))
  const district = districts.data?.find((each) => sameName(each.name, cityValue))

  const { onChange: setProvince } = province.field
  const { onChange: setCity } = city.field
  useEffect(() => {
    if (match && match.name !== provinceValue) {
      setProvince(match.name)
    }
  }, [match, provinceValue, setProvince])
  useEffect(() => {
    if (district && district.name !== cityValue) {
      setCity(district.name)
    }
  }, [district, cityValue, setCity])

  const id = (key: string) => `${idPrefix}-${key}`
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label={t("address.province")}
        htmlFor={id("province")}
        error={errors.province}
        required
      >
        <Select
          value={match?.name ?? provinceValue}
          onValueChange={(next) => {
            // Radix reports "" while a value waits for its item; a person never picks ""
            if (!next || next === provinceValue) {
              return
            }
            setProvince(next)
            // A district of another province no longer fits
            setCity("")
          }}
        >
          <SelectTrigger id={id("province")} className="w-full">
            <SelectValue placeholder={t("address.choose")} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {(provinces.data ?? []).map((each) => (
              <SelectItem key={each.id} value={each.name}>
                {each.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("address.district")} htmlFor={id("city")} error={errors.city} required>
        <Select
          value={district?.name ?? cityValue}
          onValueChange={(next) => {
            if (next) {
              setCity(next)
            }
          }}
          disabled={!match}
        >
          <SelectTrigger id={id("city")} className="w-full">
            <SelectValue placeholder={match ? t("address.choose") : t("address.provinceFirst")} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {(districts.data ?? []).map((each) => (
              <SelectItem key={each.id} value={each.name}>
                {each.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        label={t("address.neighborhood")}
        htmlFor={id("address_2")}
        error={errors.address_2}
        className="sm:col-span-2"
      >
        <Input id={id("address_2")} maxLength={200} {...neighborhood.field} />
      </Field>
      <Field
        label={t("address.line")}
        htmlFor={id("address_1")}
        hint={t("address.lineHint")}
        error={errors.address_1}
        className="sm:col-span-2"
        required
      >
        <Input
          id={id("address_1")}
          autoComplete="street-address"
          maxLength={200}
          {...address.field}
        />
      </Field>
      <Field label={t("address.postalCode")} htmlFor={id("postal_code")} error={errors.postal_code}>
        <Input
          id={id("postal_code")}
          inputMode="numeric"
          maxLength={5}
          autoComplete="postal-code"
          {...postal.field}
        />
      </Field>
      <Field label={t("address.phone")} htmlFor={id("phone")} error={errors.phone}>
        <Input id={id("phone")} type="tel" autoComplete="tel" maxLength={30} {...phone.field} />
      </Field>
    </div>
  )
}
