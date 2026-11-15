"use client"

import { useState } from "react"
import type { InstallmentFamilyView } from "@qticaret/ui"
import type { InstallmentWords } from "./words"

const PILL =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gf-pill rounded-pill px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-(--dur-micro) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus"

/**
 * The dialog's inside (owner 2026-11-05): the card programs as real
 * radios in filled pills (the arrow keys step through them), then the
 * chosen program's plans as one ruled table: count, monthly, total, the
 * counts at the price of one payment marked; tabular figures, every
 * amount the storefront's words. It opens on `first` (the program the
 * line under the price quoted), else the first.
 */
export function InstallmentPlans({
  families,
  first,
  words,
}: {
  families: InstallmentFamilyView[]
  first: string | null
  words: InstallmentWords
}) {
  const [picked, setPicked] = useState(first ?? families[0]?.family ?? "")
  const family = families.find((each) => each.family === picked) ?? families[0]
  if (!family) {
    return null
  }
  return (
    <div className="flex flex-col gap-5">
      {families.length > 1 && (
        <fieldset>
          <legend className="sr-only">{words.family}</legend>
          <div className="flex flex-wrap gap-2">
            {families.map((each) => (
              <label key={each.family} className={PILL}>
                <input
                  type="radio"
                  name="taksit-programi"
                  value={each.family}
                  checked={each.family === family.family}
                  onChange={() => {
                    setPicked(each.family)
                  }}
                  className="sr-only"
                />
                {each.family}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <table className="tabular w-full border-collapse text-left text-sm">
        <caption className="sr-only">{family.family}</caption>
        <thead>
          <tr className="text-xs text-text-2">
            <th scope="col" className="pb-1.5 font-semibold">
              {words.count}
            </th>
            <th scope="col" className="pb-1.5 text-right font-semibold">
              {words.per}
            </th>
            <th scope="col" className="pb-1.5 text-right font-semibold">
              {words.total}
            </th>
          </tr>
        </thead>
        <tbody>
          {family.options.map((option) => (
            <tr key={option.count} className="border-t border-rule">
              <th scope="row" className="py-1.5 pr-3 font-semibold">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  {option.count === 1 ? words.single : option.count}
                  {option.free && (
                    <span className="text-xs font-semibold text-ok">{words.free}</span>
                  )}
                </span>
              </th>
              <td className="py-1.5 text-right">{option.perInstallment}</td>
              <td className="py-1.5 text-right text-text-2">{option.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
