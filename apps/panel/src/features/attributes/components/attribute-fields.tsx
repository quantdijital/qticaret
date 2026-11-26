import type { Dispatch, SetStateAction } from "react"
import { isEmpty } from "@/features/attributes/empty"
import { isSelectType } from "@/features/attributes/types"
import type { AttributeDefinition, AttributeValue } from "@/features/attributes/types"
import type { AddOption } from "@/features/attributes/use-add-option"
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
  addOption,
}: {
  definitions: readonly AttributeDefinition[]
  values: Record<string, AttributeValue>
  setValues: Dispatch<SetStateAction<Record<string, AttributeValue>>>
  ai: AttributesAi
  /** A list field's missing value added to the group from the product. */
  addOption?: AddOption | undefined
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
        // One row per attribute (WooCommerce's): no field leaves a gap beside a tall neighbour
        <div className="flex flex-col divide-y border-y">
          {definitions.map((definition) => {
            const suggested = offered.includes(definition) ? ai.valueFor(definition.key) : undefined
            return (
              <div
                key={definition.key}
                className="flex flex-col gap-2 py-3 @lg/attrs:[&>:not(:first-child)]:ml-[calc(11rem+1.5rem)]"
              >
                <AttributeInput
                  row
                  definition={definition}
                  value={values[definition.key]}
                  addOption={
                    addOption && isSelectType(definition.type)
                      ? (label) => addOption(definition.key, label)
                      : undefined
                  }
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
