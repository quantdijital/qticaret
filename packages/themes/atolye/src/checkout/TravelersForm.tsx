"use client"

import type { SaveTravelers, TravelerGroupView, TravelersStepView } from "@qticaret/ui"
import { useKeptForm } from "@qticaret/ui/hooks/use-kept-form"
import { FieldError, SelectField, TextField } from "./fields"

export interface TravelersWords {
  /** "{n}. katılımcı". */
  person: (n: number) => string
  firstName: string
  lastName: string
  birthDate: string
  document: string
  documentHint: string
  /** "Kayıtlı: ***1234 — devam etmek için yeniden yazın". */
  documentSaved: (masked: string) => string
  nationality: string
  choose: string
  note: string
  submit: string
  saving: string
  errors: Record<string, string>
  fallback: string
}

const LEVELS = ["name", "birth_date", "identity", "nationality"] as const
const asks = (group: TravelerGroupView, level: (typeof LEVELS)[number]) =>
  LEVELS.indexOf(group.level) >= LEVELS.indexOf(level)

/**
 * The travelers step (adr/0076 §7, Ek D6b): for each departure that asks,
 * one block per place with only the fields its product asks (no more is
 * taken). What was entered comes back filled; a number only as its last
 * four (it is not sent back), so its field starts empty and is typed
 * again. A refusal names its field when the storefront knows it.
 */
export function TravelersForm({
  step,
  save,
  words,
}: {
  step: TravelersStepView
  save: SaveTravelers
  words: TravelersWords
}) {
  const { state, pending, form } = useKeptForm(save)
  const message = state.error ? (words.errors[state.error] ?? words.fallback) : null
  // Each group's first traveler's number
  const firsts = step.groups.map((_, index) =>
    step.groups.slice(0, index).reduce((sum, group) => sum + group.count, 0)
  )
  return (
    <form {...form} className="flex flex-col gap-8" noValidate>
      <p className="text-sm text-text-2">{words.note}</p>
      {step.groups.map((group, groupIndex) => (
        <fieldset key={group.slotId} className="flex flex-col gap-6">
          <legend className="mb-4 flex flex-col gap-0.5">
            <span className="font-semibold">{group.title}</span>
            <span className="text-sm text-text-2">{group.when}</span>
          </legend>
          {Array.from({ length: group.count }, (_, position) => {
            // Counted across the groups, as the form's fields are named
            const n = (firsts[groupIndex] ?? 0) + position
            const at = `traveler.${String(n)}`
            const id = `katilimci-${String(n)}`
            const person = group.people[position]
            const errorOf = (field: string) => (state.field === `${at}.${field}` ? message : null)
            return (
              <div
                key={`${group.slotId}-${String(position)}`}
                className="flex flex-col gap-4 rounded-media gf-pane-inner p-4"
              >
                <p className="text-sm font-semibold">{words.person(position + 1)}</p>
                <input type="hidden" name={`${at}.slot_id`} value={group.slotId} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    id={`${id}-ad`}
                    name={`${at}.first_name`}
                    label={words.firstName}
                    autoComplete="off"
                    required
                    maxLength={100}
                    defaultValue={person?.firstName ?? ""}
                    error={errorOf("first_name")}
                  />
                  <TextField
                    id={`${id}-soyad`}
                    name={`${at}.last_name`}
                    label={words.lastName}
                    autoComplete="off"
                    required
                    maxLength={100}
                    defaultValue={person?.lastName ?? ""}
                    error={errorOf("last_name")}
                  />
                  {asks(group, "birth_date") && (
                    <TextField
                      id={`${id}-dogum`}
                      name={`${at}.birth_date`}
                      type="date"
                      label={words.birthDate}
                      autoComplete="off"
                      required
                      max={step.maxBirthDate}
                      defaultValue={person?.birthDate ?? ""}
                      error={errorOf("birth_date")}
                    />
                  )}
                  {asks(group, "identity") && (
                    <TextField
                      id={`${id}-belge`}
                      name={`${at}.document_no`}
                      label={words.document}
                      hint={
                        person?.documentMasked
                          ? words.documentSaved(person.documentMasked)
                          : words.documentHint
                      }
                      autoComplete="off"
                      spellCheck={false}
                      required
                      maxLength={40}
                      defaultValue=""
                      error={errorOf("document_no")}
                    />
                  )}
                  {asks(group, "nationality") && (
                    <SelectField
                      id={`${id}-uyruk`}
                      name={`${at}.nationality`}
                      label={words.nationality}
                      required
                      defaultValue={person?.nationality ?? ""}
                      error={errorOf("nationality")}
                    >
                      <option value="" disabled>
                        {words.choose}
                      </option>
                      {step.countries.map((country) => (
                        <option key={country.value} value={country.value}>
                          {country.label}
                        </option>
                      ))}
                    </SelectField>
                  )}
                </div>
              </div>
            )
          })}
        </fieldset>
      ))}
      <div role="alert">
        <FieldError id="katilimci-hata" message={state.field ? null : message} />
      </div>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="gf-btn w-full sm:w-auto sm:self-start"
      >
        {pending ? words.saving : words.submit}
      </button>
    </form>
  )
}
