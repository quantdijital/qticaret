import { Columns3 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import { COLUMN_LABEL, OPTIONAL_COLUMNS } from "@/features/customers/list-prefs"
import type { OptionalColumn } from "@/features/customers/list-prefs"

/**
 * "Sütunlar" beside the search: which optional columns the customer list
 * shows. The menu stays open while columns are ticked.
 */
export function ColumnOptions({
  hidden,
  onChange,
}: {
  hidden: readonly OptionalColumn[]
  onChange: (next: readonly OptionalColumn[]) => void
}) {
  const { t } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label={t("customers.columnOptions")}>
          <Columns3 />
          <span className="max-sm:sr-only">{t("customers.columnOptions")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>{t("customers.columnOptions")}</DropdownMenuLabel>
        {OPTIONAL_COLUMNS.map((column) => (
          <DropdownMenuCheckboxItem
            key={column}
            checked={!hidden.includes(column)}
            onSelect={(event) => {
              event.preventDefault()
            }}
            onCheckedChange={(shown) => {
              onChange(shown ? hidden.filter((item) => item !== column) : [...hidden, column])
            }}
          >
            {t(COLUMN_LABEL[column])}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
