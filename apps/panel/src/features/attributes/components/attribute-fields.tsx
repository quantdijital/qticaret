import type { Dispatch, SetStateAction } from "react"
import { isEmpty } from "@/features/attributes/empty"
import type { AttributeDefinition, AttributeValue } from "@/features/attributes/types"
import type { AttributesAi } from "@/features/attributes/use-attributes-ai"
import { AttributeInput } from "./attribute-input"
import { AttributeSuggestion, AttributesAiBar } from "./attributes-ai"

/**
 * The template's fields in the product's attributes card, with the AI's
 * values (adr/0074 §5 madde 3) offered under the fields still empty in
 * the form: "Uygula" writes one, "Hepsini uygula" all; the card's Save
 * stores them, or not.
 */
export function AttributeFields({
  definitions,
  values,
  setValues,
  ai,
}: {
  definitions: readonly AttributeDefinition[]
  values: Record<string, AttributeValue>
  setValues: Dispatch<SetStateAction<Record<string, AttributeValue>>>
  ai: AttributesAi
}) {
  const offered = definitions.filter(
    (definition) => isEmpty(values[definition.key]) && ai.valueFor(definition.key) !== undefined
  )
  const apply = (keys: readonly string[]) => {
    setValues((was) => {
      const next = { ...was }
      for (const key of keys) {
        const value = ai.valueFor(key)
        if (value !== undefined) {
          next[key] = value
        }
      }
      return next
    })
    ai.taken()
  }

  return (
    <>
      <AttributesAiBar
        ai={ai}
        offered={offered.length}
        onApplyAll={() => {
          apply(offered.map((definition) => definition.key))
        }}
      />
      {definitions.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {definitions.map((definition) => {
            const suggested = offered.includes(definition) ? ai.valueFor(definition.key) : undefined
            return (
              <div key={definition.key}>
                <AttributeInput
                  definition={definition}
                  value={values[definition.key]}
                  onChange={(next) => {
                    setValues((was) => ({ ...was, [definition.key]: next }))
                  }}
                />
                {suggested === undefined ? null : (
                  <AttributeSuggestion
                    definition={definition}
                    value={suggested}
                    onApply={() => {
                      apply([definition.key])
                    }}
                    onIgnore={() => {
                      ai.ignore(definition.key)
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      ) : null}
    </>
  )
}
