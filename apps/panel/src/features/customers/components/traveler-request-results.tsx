import { Link } from "@tanstack/react-router"
import { Download, Trash2, TriangleAlert } from "lucide-react"
import { Fragment, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { formatDate, formatDateTime } from "@qticaret/admin-ui/lib/format"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { EmptyState } from "@qticaret/admin-ui/patterns/states"
import { Alert, AlertDescription } from "@qticaret/admin-ui/ui/alert"
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
import type { FoundTraveler, TravelerSearch } from "@/features/customers/api/traveler-requests"
import { downloadTravelerCopy } from "@/features/customers/traveler-copy"
import { searchWarnings } from "@/features/customers/traveler-search"
import type { SearchWarnings } from "@/features/customers/traveler-search"
import { birthDateText, countryText } from "@/features/products/booking/traveler-text"
import { errorText } from "@/lib/errors"
import { isReauthCancelled } from "@/lib/reauth"

const R = "customers.travelerRequests"

// A fact the rows disagree on, marked so the eye catches it (review O1)
const MARKED = "rounded-sm bg-warning-soft px-1 font-medium text-warning-text"

/**
 * What the search found (adr/0076 Ek D6b): each row with its trip and
 * order, the number masked. Nothing is ticked at first (security review
 * O1): staff tick the rows that are the person asking, warned when a name
 * alone or more than one row may be other people, and the rows that hold
 * different birth dates or nationalities marked. The rows ticked go into
 * the person's copy (a JSON file, as the customers' own) or are deleted
 * for good after a confirmation naming each, proved again.
 */
export function TravelerRequestResults({
  asked,
  rows,
  onErased,
}: {
  asked: TravelerSearch
  rows: FoundTraveler[]
  onErased: () => void
}) {
  const { t, i18n } = useTranslation()
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set())
  const [confirming, setConfirming] = useState(false)
  const erase = useEraseTravelers()
  if (rows.length === 0) {
    return <EmptyState text={t(`${R}.noneFound`)} />
  }
  const warnings = searchWarnings(asked, rows)
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
  const tripOf = (row: FoundTraveler) =>
    [row.product_title ?? "—", row.starts_at ? formatDateTime(row.starts_at) : "—"].join(" · ")
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
      <Warnings warnings={warnings} />
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
            const birth = birthDateText(row.birth_date, i18n.language)
            const country = countryText(row.nationality, i18n.language)
            const facts = [
              birth ? { text: birth, marked: warnings.birthDates } : null,
              country ? { text: country, marked: warnings.nationalities } : null,
              row.document_masked ? { text: row.document_masked, marked: false } : null,
            ].filter((fact): fact is { text: string; marked: boolean } => fact !== null)
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
                  <span className="block text-xs text-muted-foreground">
                    {facts.map((fact, at) => (
                      <Fragment key={fact.text}>
                        {at > 0 ? " · " : null}
                        {fact.marked ? (
                          <mark className={MARKED} title={t(`${R}.differs`)}>
                            {fact.text}
                          </mark>
                        ) : (
                          fact.text
                        )}
                      </Fragment>
                    ))}
                  </span>
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
      >
        <ul
          aria-label={t(`${R}.eraseList`)}
          className="max-h-56 overflow-y-auto rounded-md border text-sm"
        >
          {chosen.map((row) => (
            <li key={row.id} className="border-b px-3 py-2 last:border-b-0">
              <span className="block font-medium">{`${row.first_name} ${row.last_name}`}</span>
              <span className="block text-xs text-muted-foreground">{tripOf(row)}</span>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </section>
  )
}

/** The warnings above the rows: a name alone or many rows, and rows that disagree. */
function Warnings({ warnings }: { warnings: SearchWarnings }) {
  const { t } = useTranslation()
  if (!warnings.narrow && !warnings.mixed) {
    return null
  }
  return (
    <div className="flex flex-col gap-2 px-5">
      {warnings.narrow ? (
        <Alert className="border-warning/40 bg-warning-soft">
          <TriangleAlert aria-hidden="true" className="text-warning-text" />
          <AlertDescription>{t(`${R}.narrowWarning`)}</AlertDescription>
        </Alert>
      ) : null}
      {warnings.mixed ? (
        <Alert className="border-warning/40 bg-warning-soft">
          <TriangleAlert aria-hidden="true" className="text-warning-text" />
          <AlertDescription>{t(`${R}.mixedWarning`)}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
