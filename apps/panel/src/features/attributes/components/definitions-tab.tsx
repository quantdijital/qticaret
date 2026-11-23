import { Plus } from "lucide-react"
import { useState } from "react"
import { useFieldArray, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { dropIndex, followMove, followRemove } from "@/features/attributes/definition-list"
import type { DropPlace } from "@/features/attributes/definition-list"
import { emptyDefinition } from "@/features/attributes/form"
import type { TemplateForm } from "@/features/attributes/form"
import { DefinitionRow } from "./definition-row"

const A = "attributes"

/**
 * The template's attributes, one line each, in the product page's order.
 * One is open at a time; a new one opens with the caret in its name.
 * Rows are dragged into place or moved from their menu.
 */
export function DefinitionsTab() {
  const { t } = useTranslation()
  const { control } = useFormContext<TemplateForm>()
  const definitions = useFieldArray({ control, name: "definitions", keyName: "fieldKey" })
  const [open, setOpen] = useState<number | null>(null)
  const [dragged, setDragged] = useState<number | null>(null)
  const [over, setOver] = useState<{ at: number; place: DropPlace } | null>(null)
  const count = definitions.fields.length

  const move = (from: number, to: number) => {
    if (to < 0 || to >= count || to === from) {
      return
    }
    definitions.move(from, to)
    setOpen((current) => followMove(current, from, to))
  }
  const endDrag = () => {
    setDragged(null)
    setOver(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {count === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {t(`${A}.noDefinitions`)}
        </p>
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-md border">
          {definitions.fields.map((field, index) => (
            <DefinitionRow
              key={field.fieldKey}
              index={index}
              count={count}
              open={open === index}
              onToggle={() => {
                setOpen((current) => (current === index ? null : index))
              }}
              onMove={(to) => {
                move(index, to)
              }}
              onRemove={() => {
                definitions.remove(index)
                setOpen((current) => followRemove(current, index))
              }}
              drag={{
                active: dragged !== null,
                dragging: dragged === index,
                over: over?.at === index && dragged !== index ? over.place : null,
                onStart: () => {
                  setDragged(index)
                },
                onEnd: endDrag,
                onOver: (place) => {
                  setOver({ at: index, place })
                },
                onDrop: (place) => {
                  if (dragged !== null) {
                    move(dragged, dropIndex(dragged, index, place))
                  }
                  endDrag()
                },
              }}
            />
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => {
          definitions.append(emptyDefinition(), { focusName: `definitions.${count}.label` })
          setOpen(count)
        }}
      >
        <Plus />
        {t(`${A}.add`)}
      </Button>
    </div>
  )
}
