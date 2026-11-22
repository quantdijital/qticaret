import { Link } from "@tanstack/react-router"
import { Download, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { formatDate, formatDateTime } from "@qticaret/admin-ui/lib/format"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { EmptyState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qticaret/admin-ui/ui/table"
import { useEraseTravelers } from "@/features/customers/api/traveler-requests"
import type { FoundTraveler } from "@/features/customers/api/traveler-requests"
import { downloadTravelerCopy } from "@/features/customers/traveler-copy"
import { birthDateText, countryText } from "@/features/products/booking/traveler-text"
import { errorText } from "@/lib/errors"
import { isReauthCancelled } from "@/lib/reauth"

const R = "customers.travelerRequests"

/**
 * What the search found (adr/0076 Ek D6b): each row with its trip and
 * order, the number masked. The rows ticked go into the person's copy (a
 * JSON file, as the customers' own) or are deleted for good, proved again.
 */
export function TravelerRequestResults({
  rows,
  onErased,
}: {
  rows: FoundTraveler[]
  onErased: () => void
}) {
  const { t, i18n } = useTranslation()
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(rows.map((r) => r.id)))
  const [confirming, setConfirming] = useState(false)
  const erase = useEraseTravelers()
  if (rows.length === 0) {
    return <EmptyState text={t(`${R}.noneFound`)} />
  }
  const chosen = rows.filter((row) => picked.has(row.id))
  const toggle = (id: string, on: boolean) => {
    const next = new Set(picked)
    if (on) {
      next.add(id)
    } else {
      next.delete(id)
    }
    setPicked(next)
  }
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
        <p className="mr-auto text-sm text-muted-foreground">
          {t(`${R}.found`, { count: rows.length })}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={chosen.length === 0}
          onClick={() => {
            downloadTravelerCopy(chosen)
          }}
        >
          <Download />
          {t(`${R}.download`)}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive-text"
          disabled={chosen.length === 0 || erase.isPending}
          onClick={() => {
            setConfirming(true)
          }}
        >
          <Trash2 />
          {t(`${R}.erase`)}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <span className="sr-only">{t(`${R}.pick`)}</span>
            </TableHead>
            <TableHead>{t(`${R}.columns.person`)}</TableHead>
            <TableHead>{t(`${R}.columns.trip`)}</TableHead>
            <TableHead>{t(`${R}.columns.order`)}</TableHead>
            <TableHead>{t(`${R}.columns.purge`)}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const facts = [
              birthDateText(row.birth_date, i18n.language),
              countryText(row.nationality, i18n.language),
              row.document_masked,
            ].filter((fact): fact is string => fact !== null)
            const name = `${row.first_name} ${row.last_name}`
            return (
              <TableRow key={row.id}>
                <TableCell>
                  <Checkbox
                    checked={picked.has(row.id)}
                    aria-label={t(`${R}.pickOne`, { name })}
                    onCheckedChange={(state) => {
                      toggle(row.id, state === true)
                    }}
                  />
                </TableCell>
                <TableCell>
                  <span className="block font-medium">{name}</span>
                  <span className="block text-xs text-muted-foreground">{facts.join(" · ")}</span>
                </TableCell>
                <TableCell>
                  <span className="block">{row.product_title ?? "—"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {row.starts_at ? formatDateTime(row.starts_at) : "—"}
                  </span>
                </TableCell>
                <TableCell>
                  {row.order_id ? (
                    <Link
                      to="/orders/$id"
                      params={{ id: row.order_id }}
                      className="font-medium hover:underline"
                    >
                      {row.display_id === null ? row.order_id : `#${String(row.display_id)}`}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{t(`${R}.inCart`)}</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(row.purge_after)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(`${R}.eraseTitle`, { count: chosen.length })}
        description={t(`${R}.eraseText`)}
        confirmLabel={t(`${R}.eraseConfirm`)}
        destructive
        onConfirm={() => {
          erase.mutate(
            chosen.map((row) => row.id),
            {
              onSuccess: (answer) => {
                toast.success(t(`${R}.erased`, { count: answer.deleted }))
                onErased()
              },
              onError: (failure) => {
                if (!isReauthCancelled(failure)) {
                  toast.error(errorText(t, failure))
                }
              },
            }
          )
        }}
      />
    </section>
  )
}
