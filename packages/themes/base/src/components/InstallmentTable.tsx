"use client"

import { useState } from "react"
import type { InstallmentFamilyView } from "@qticaret/ui"

export interface InstallmentWords {
  title: string
  loading: string
  none: string
  count: string
  per: string
  total: string
  single: string
}

/**
 * The installment plans (F5), asked only when opened: each view of the
 * product would otherwise call the payment provider. A table per card
 * family; one plan of one installment reads "Tek çekim".
 */
export function InstallmentTable({
  variantId,
  load,
  words,
}: {
  variantId: string
  load: (variantId: string) => Promise<InstallmentFamilyView[] | null>
  words: InstallmentWords
}) {
  const [state, setState] = useState<{
    id: string
    families: InstallmentFamilyView[] | null
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const shown = state?.id === variantId ? state.families : undefined
  return (
    <details
      className="rounded-xl border p-3 text-sm"
      onToggle={(event) => {
        if (event.currentTarget.open && shown === undefined && !busy) {
          setBusy(true)
          void load(variantId).then((families) => {
            setState({ id: variantId, families })
            setBusy(false)
          })
        }
      }}
    >
      <summary className="cursor-pointer font-medium">{words.title}</summary>
      <div className="mt-3 flex flex-col gap-4">
        {shown === undefined ? (
          <p className="text-muted-foreground">{words.loading}</p>
        ) : shown === null ? (
          <p className="text-muted-foreground">{words.none}</p>
        ) : (
          shown.map((family) => (
            <table key={family.family} className="w-full text-left tabular">
              <caption className="mb-1 text-left font-semibold">{family.family}</caption>
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th scope="col">{words.count}</th>
                  <th scope="col">{words.per}</th>
                  <th scope="col">{words.total}</th>
                </tr>
              </thead>
              <tbody>
                {family.options.map((option) => (
                  <tr key={option.count} className="border-t">
                    <td className="py-1">{option.count === 1 ? words.single : option.count}</td>
                    <td>{option.perInstallment}</td>
                    <td>{option.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))
        )}
      </div>
    </details>
  )
}
