import { Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { SearchPicker } from "@qticaret/admin-ui/patterns/search-picker"
import type { PickerOption } from "@qticaret/admin-ui/patterns/search-picker"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogSection } from "@qticaret/admin-ui/ui/dialog"
import { searchVariants } from "@/features/orders/api/edit"

const E = "orders.edit"

/**
 * The order edit's "add a product" part (adr/0033): a variant found by
 * name and how many; added once (a second time it is already a line).
 */
export function EditAddLine({
  taken,
  onAdd,
}: {
  /** Variants already added */
  taken: ReadonlySet<string>
  onAdd: (variant: PickerOption, quantity: number) => void
}) {
  const { t } = useTranslation()
  const [picked, setPicked] = useState<PickerOption | null>(null)
  const [count, setCount] = useState(1)
  return (
    <DialogSection title={t(`${E}.addTitle`)}>
      {/* One row of 36 px controls; a phone stacks the search over the count */}
      <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
        <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
          {/* A combobox takes its name from a label, not from what it shows */}
          <label htmlFor="order-edit-add" className="sr-only">
            {t(`${E}.addLabel`)}
          </label>
          <SearchPicker
            id="order-edit-add"
            value={picked}
            onChange={setPicked}
            search={searchVariants}
            queryKey={["orders", "edit", "variants"]}
            placeholder={t(`${E}.addPlaceholder`)}
            empty={t(`${E}.addEmpty`)}
            className="sm:max-w-none"
          />
        </div>
        <NumberField
          plain
          min={1}
          aria-label={t(`${E}.addQuantity`)}
          className="w-28 flex-1 sm:flex-none"
          value={count}
          onChange={(event) => {
            setCount(Math.max(1, Math.trunc(Number(event.target.value)) || 1))
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!picked || taken.has(picked.id)}
          onClick={() => {
            if (picked) {
              onAdd(picked, count)
              setPicked(null)
              setCount(1)
            }
          }}
        >
          <Plus />
          {t(`${E}.add`)}
        </Button>
      </div>
    </DialogSection>
  )
}
