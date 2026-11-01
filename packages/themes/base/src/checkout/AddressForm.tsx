"use client"

import { ArrowRight, LoaderCircle } from "lucide-react"
import { startTransition, useActionState, useState } from "react"
import type { ActionResult, AddressStepView, CheckoutActions, OptionView } from "@qticaret/ui"
import { Button } from "@qticaret/ui/components/button"
import { SelectField, TextField } from "./fields"

const INITIAL: ActionResult = { ok: false, error: null }

export interface AddressWords {
  email: string
  emailHint: string
  phone: string
  phoneHint: string
  firstName: string
  lastName: string
  province: string
  district: string
  neighborhood: string
  choose: string
  street: string
  streetHint: string
  submit: string
  saving: string
  errors: Record<string, string>
  fallback: string
}

/**
 * The contact and delivery address: province, district and neighbourhood
 * from the country's own lists (each select fills the next), the street
 * and door typed. Sent without the browser clearing the fields, so a
 * refused address keeps what the shopper typed.
 */
export function AddressForm({
  step,
  actions,
  words,
}: {
  step: AddressStepView
  actions: Pick<CheckoutActions, "saveAddress" | "districts" | "neighborhoods">
  words: AddressWords
}) {
  const [state, dispatch, pending] = useActionState(actions.saveAddress, INITIAL)
  const [province, setProvince] = useState(step.values.province)
  const [district, setDistrict] = useState(step.values.district)
  const [districts, setDistricts] = useState<OptionView[]>(step.districts)
  const [neighborhoods, setNeighborhoods] = useState<OptionView[]>(step.neighborhoods)
  const [loading, setLoading] = useState<"district" | "neighborhood" | null>(null)

  async function chooseProvince(value: string) {
    setProvince(value)
    setDistrict("")
    setDistricts([])
    setNeighborhoods([])
    if (value) {
      setLoading("district")
      setDistricts(await actions.districts(value))
      setLoading(null)
    }
  }

  async function chooseDistrict(value: string) {
    setDistrict(value)
    setNeighborhoods([])
    if (value) {
      setLoading("neighborhood")
      setNeighborhoods(await actions.neighborhoods(value))
      setLoading(null)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        startTransition(() => {
          dispatch(form)
        })
      }}
      className="grid gap-4 sm:grid-cols-2"
      noValidate={false}
    >
      <TextField
        id="email"
        name="email"
        type="email"
        label={words.email}
        hint={words.emailHint}
        autoComplete="email"
        required
        defaultValue={step.values.email}
        className="sm:col-span-2"
      />
      <TextField
        id="first_name"
        name="first_name"
        label={words.firstName}
        autoComplete="given-name"
        required
        maxLength={60}
        defaultValue={step.values.first_name}
      />
      <TextField
        id="last_name"
        name="last_name"
        label={words.lastName}
        autoComplete="family-name"
        required
        maxLength={60}
        defaultValue={step.values.last_name}
      />
      <TextField
        id="phone"
        name="phone"
        type="tel"
        label={words.phone}
        hint={words.phoneHint}
        autoComplete="tel-national"
        inputMode="tel"
        required
        defaultValue={step.values.phone}
        className="sm:col-span-2"
      />
      <SelectField
        id="province"
        name="province"
        label={words.province}
        required
        value={province}
        onChange={(event) => void chooseProvince(event.target.value)}
      >
        <option value="">{words.choose}</option>
        {step.provinces.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="district"
        name="district"
        label={words.district}
        required
        disabled={!province || loading === "district"}
        value={district}
        onChange={(event) => void chooseDistrict(event.target.value)}
      >
        <option value="">{words.choose}</option>
        {districts.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="neighborhood"
        name="neighborhood"
        label={words.neighborhood}
        required
        disabled={!district || loading === "neighborhood"}
        defaultValue={step.values.neighborhood}
        key={district}
        className="sm:col-span-2"
      >
        <option value="">{words.choose}</option>
        {neighborhoods.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <TextField
        id="address_1"
        name="address_1"
        label={words.street}
        hint={words.streetHint}
        autoComplete="street-address"
        required
        minLength={5}
        maxLength={200}
        defaultValue={step.values.address_1}
        className="sm:col-span-2"
      />
      <div className="flex flex-col gap-3 sm:col-span-2">
        <p role="alert" className="text-sm font-medium text-sale empty:hidden">
          {state.error ? (words.errors[state.error] ?? words.fallback) : null}
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="h-12 rounded-full px-7 text-[15px] sm:self-start"
        >
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
          {pending ? words.saving : words.submit}
          {!pending && <ArrowRight aria-hidden="true" />}
        </Button>
      </div>
    </form>
  )
}
