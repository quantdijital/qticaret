import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { Button } from "../ui/button"
import { formatCount } from "../lib/format"

interface PaginationProps {
  /** Zero-based. */
  page: number
  pageSize: number
  count: number
  onPageChange: (page: number) => void
}

/** "21–40 / 87" and previous / next under a list. */
export function Pagination({ page, pageSize, count, onPageChange }: PaginationProps) {
  const { t } = useTranslation(ADMIN_UI_NS)
  const pages = Math.max(1, Math.ceil(count / pageSize))
  const from = count === 0 ? 0 : page * pageSize + 1
  const to = Math.min(count, (page + 1) * pageSize)
  return (
    <div className="flex items-center justify-between gap-3 border-t px-5 py-3 text-sm text-muted-foreground">
      <span className="tabular">
        {t("list.range", {
          from: formatCount(from),
          to: formatCount(to),
          total: formatCount(count),
        })}
      </span>
      <div className="flex items-center gap-2">
        <span className="tabular hidden sm:inline">
          {t("list.page", { page: page + 1, pages })}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label={t("list.previous")}
          disabled={page === 0}
          onClick={() => {
            onPageChange(page - 1)
          }}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label={t("list.next")}
          disabled={page + 1 >= pages}
          onClick={() => {
            onPageChange(page + 1)
          }}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
