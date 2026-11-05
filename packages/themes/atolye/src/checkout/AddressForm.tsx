"use client"

import { startTransition, useActionState, useEffect, useRef, useState } from "react"
import type { ActionResult, AddressStepView, CheckoutActions, OptionView } from "@qticaret/ui"
import { FIELD_OF_ERROR, firstProblem, type AddressField } from "./address-check"
import { SelectField, TextField } from "./fields"

const INITIAL: ActionResult = { ok: false, error: null }

export interface AddressWords {
  contact: string
  delivery: string
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
  loading: string
  street: string
  streetHint: string
  submit: string
  saving: string
  errors: Record<string, string>
  fallback: string
}

const LEGEND = "mb-4 text-md font-extrabold tracking-[-0.01em]"

/**
 * The contact and the delivery address: e-mail and phone first, then the
 * name, province, district and neighbourhood from the country's own lists
 * (each select fills the next, the next one says it is loading in its own
 * place), the street typed. The form looks first in the browser and says
 * a refusal under its field, the field focused; the action checks again
 * and its refusal lands the same way. Sent without the browser clearing
 * the fields, so a refused address keeps what was typed.
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
  const [local, setLocal] = useState<{ field: AddressField; error: string } | null>(null)
  const [province, setProvince] = useState(step.values.province)
  const [district, setDistrict] = useState(step.values.district)
  const [districts, setDistricts] = useState<OptionView[]>(step.districts)
  const [neighborhoods, setNeighborhoods] = useState<OptionView[]>(step.neighborhoods)
  const [loading, setLoading] = useState<"district" | "neighborhood" | null>(null)
  const form = useRef<HTMLFormElement>(null)

  // A refusal stands until the shopper changes something; then it is theirs to send again
  const [edited, setEdited] = useState(false)
  const served =
    state.error && !edited
      ? { field: FIELD_OF_ERROR[state.error] ?? null, error: state.error }
      : null
  const problem = local ?? served
  const message = problem ? (words.errors[problem.error] ?? words.fallback) : null
  const errorOf = (field: AddressField) => (problem?.field === field ? message : null)

  // The server's refusal takes the focus to its field, as the browser's own look does
  useEffect(() => {
    const field = served?.field
    if (field) {
      form.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus()
    }
  }, [served?.field, state])

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

  const placeholder = (kind: "district" | "neighborhood") =>
    loading === kind ? words.loading : words.choose

  return (
    <form
      ref={form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const found = firstProblem(
          Object.fromEntries(
            [...data.entries()].map(([key, value]) => [key, typeof value === "string" ? value : ""])
          )
        )
        setLocal(found)
        setEdited(false)
        if (found) {
          event.currentTarget.querySelector<HTMLElement>(`[name="${found.field}"]`)?.focus()
          return
        }
        startTransition(() => {
          dispatch(data)
        })
      }}
      onChange={() => {
        setLocal(null)
        setEdited(true)
      }}
      className="flex flex-col gap-8"
    >
      <fieldset className="grid gap-4">
        <legend className={LEGEND}>{words.contact}</legend>
        <TextField
          id="email"
          name="email"
          type="email"
          label={words.email}
          hint={words.emailHint}
          error={errorOf("email")}
          autoComplete="email"
          inputMode="email"
          required
          maxLength={254}
          defaultValue={step.values.email}
        />
        <TextField
          id="phone"
          name="phone"
          type="tel"
          label={words.phone}
          hint={words.phoneHint}
          error={errorOf("phone")}
          autoComplete="tel-national"
          inputMode="tel"
          required
          defaultValue={step.values.phone}
        />
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className={LEGEND}>{words.delivery}</legend>
        <TextField
          id="first_name"
          name="first_name"
          label={words.firstName}
          error={errorOf("first_name")}
          autoComplete="given-name"
          required
          maxLength={60}
          defaultValue={step.values.first_name}
        />
        <TextField
          id="last_name"
          name="last_name"
          label={words.lastName}
          error={errorOf("last_name")}
          autoComplete="family-name"
          required
          maxLength={60}
          defaultValue={step.values.last_name}
        />
        <SelectField
          id="province"
          name="province"
          label={words.province}
          error={errorOf("province")}
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
          error={errorOf("district")}
          required
          disabled={!province || loading === "district"}
          aria-busy={loading === "district" || undefined}
          value={district}
          onChange={(event) => void chooseDistrict(event.target.value)}
        >
          <option value="">{placeholder("district")}</option>
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
          error={errorOf("neighborhood")}
          required
          disabled={!district || loading === "neighborhood"}
          aria-busy={loading === "neighborhood" || undefined}
          defaultValue={step.values.neighborhood}
          key={district}
          className="sm:col-span-2"
        >
          <option value="">{placeholder("neighborhood")}</option>
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
          error={errorOf("address_1")}
          autoComplete="street-address"
          required
          minLength={5}
          maxLength={200}
          defaultValue={step.values.address_1}
          className="sm:col-span-2"
        />
      </fieldset>
      <div className="flex flex-col gap-3">
        {problem?.field === null && (
          <p role="alert" className="text-sm font-semibold text-error">
            {message}
          </p>
        )}
        <p role="status" className="sr-only">
          {message}
        </p>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className="gf-btn w-full sm:w-auto sm:self-start"
        >
          {pending ? words.saving : words.submit}
        </button>
      </div>
    </form>
  )
}
