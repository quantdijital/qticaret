"use client"

import { ChevronDown, CreditCard } from "lucide-react"
import { useState } from "react"
import type { InstallmentFamilyView } from "@qticaret/ui"
import type { InstallmentWords } from "./words"

/**
 * The instalment plans (F5) as a filled row that opens: asked of the
 * payment provider only when the shopper opens it (each view would
 * otherwise call it), for the variant chosen. Opened, the most
 * instalments any card offers in one line, then a table per card family:
 * count, monthly amount, total, every amount the storefront's own words.
 */
export function Installments({
  variantId,
  load,
  words,
}: {
  variantId: string
  load: (variantId: string) => Promise<InstallmentFamilyView[] | null>
  words: InstallmentWords
}) {
  const [answer, setAnswer] = useState<{
    id: string
    families: InstallmentFamilyView[] | null
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const shown = answer?.id === variantId ? answer.families : undefined
  const most = Math.max(
    0,
    ...(shown ?? []).flatMap((family) => family.options.map((option) => option.count))
  )
  return (
    <details
      className="group/taksit rounded-media bg-paper-2"
      onToggle={(event) => {
        if (event.currentTarget.open && shown === undefined && !busy) {
          setBusy(true)
          void load(variantId).then(
            (families) => {
              setAnswer({ id: variantId, families })
              setBusy(false)
            },
            () => {
              setAnswer({ id: variantId, families: null })
              setBusy(false)
            }
          )
        }
      }}
    >
      <summary className="flex min-h-12 cursor-pointer items-center gap-3 rounded-media px-4 text-sm font-semibold">
        <CreditCard className="size-5 shrink-0" aria-hidden="true" strokeWidth={1.75} />
        <span className="flex-1">{words.title}</span>
        <ChevronDown
          className="size-5 shrink-0 text-text-3 transition-transform duration-(--dur-short) group-open/taksit:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div aria-live="polite" className="flex flex-col gap-5 px-4 pt-1 pb-4 text-sm">
        {shown === undefined ? (
          <p className="text-text-2">{words.loading}</p>
        ) : shown === null || shown.length === 0 ? (
          <p className="text-text-2">{words.none}</p>
        ) : (
          <>
            {most > 1 && (
              <p className="font-semibold">{words.upTo.replace("{count}", String(most))}</p>
            )}
            {shown.map((family) => (
              <table key={family.family} className="tabular w-full border-collapse text-left">
                <caption className="pb-2 text-left text-sm font-extrabold">{family.family}</caption>
                <thead>
                  <tr className="text-xs text-text-2">
                    <th scope="col" className="pb-1 font-semibold">
                      {words.count}
                    </th>
                    <th scope="col" className="pb-1 text-right font-semibold">
                      {words.per}
                    </th>
                    <th scope="col" className="pb-1 text-right font-semibold">
                      {words.total}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {family.options.map((option) => (
                    <tr key={option.count} className="border-t border-rule">
                      <th scope="row" className="py-2 font-semibold">
                        {option.count === 1 ? words.single : option.count}
                      </th>
                      <td className="py-2 text-right">{option.perInstallment}</td>
                      <td className="py-2 text-right">{option.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </>
        )}
      </div>
    </details>
  )
}
