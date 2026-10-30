import { useQuery } from "@tanstack/react-query"
import { FileText, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { LegalPreviewDialog } from "@/features/legal/components/legal-preview-dialog"
import { orderContractQuery, orderLegalQuery } from "@/features/orders/api/legal"
import type { ContractKind } from "@/features/orders/api/legal"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@/lib/format"

const C = "orders.contracts"

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  )
}

/** The copy the order kept, asked for when opened: a recorded read. */
function CopyDialog({
  orderId,
  kind,
  onClose,
}: {
  orderId: string
  kind: ContractKind
  onClose: () => void
}) {
  const { t } = useTranslation()
  const copy = useQuery(orderContractQuery(orderId, kind))
  if (!copy.data) {
    return copy.isError ? (
      <LegalPreviewDialog
        title={t(`${C}.kinds.${kind}`)}
        html=""
        description={errorText(t, copy.error)}
        onClose={onClose}
      />
    ) : null
  }
  return (
    <LegalPreviewDialog
      title={copy.data.title}
      html={copy.data.html}
      description={t(copy.data.intact ? `${C}.copyHint` : `${C}.copyBroken`, {
        version: copy.data.version,
        hash: copy.data.html_hash.slice(0, 12),
      })}
      onClose={onClose}
    />
  )
}

/**
 * The contracts the shopper accepted at checkout (F13.2, adr/0041 §2):
 * when, from which IP address, which versions, and the copy of each the
 * order keeps, filled with its details; and the age the buyer declared
 * for a restricted product (F13.3).
 */
export function ContractsCard({ orderId }: { orderId: string }) {
  const { t } = useTranslation()
  const query = useQuery(orderLegalQuery(orderId))
  const [open, setOpen] = useState<ContractKind | null>(null)
  const consent = query.data?.consent ?? null
  const age = query.data?.age_declaration ?? null
  return (
    <SectionCard title={t(`${C}.title`)}>
      {query.isPending ? (
        <Skeleton className="h-20 rounded-md" />
      ) : query.isError ? (
        <p className="text-[13px] text-muted-foreground">{errorText(t, query.error)}</p>
      ) : !consent && !age ? (
        <p className="text-[13px] text-muted-foreground">{t(`${C}.none`)}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <dl className="flex flex-col divide-y">
            {consent ? (
              <>
                <Row label={t(`${C}.givenAt`)} value={formatDateTime(consent.given_at)} />
                <Row label={t(`${C}.ip`)} value={consent.ip ?? "—"} />
              </>
            ) : null}
            {age ? (
              <Row
                label={t(`${C}.age`)}
                value={t(`${C}.ageValue`, {
                  age: age.min_age,
                  date: formatDateTime(age.declared_at),
                })}
              />
            ) : null}
          </dl>
          {!consent ? null : consent.copies.length === 0 ? (
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t(`${C}.pending`)}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {consent.copies.map((copy) => (
                <li key={copy.kind}>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setOpen(copy.kind)
                    }}
                  >
                    <FileText aria-hidden="true" />
                    <span className="truncate">
                      {t(`${C}.open`, { title: copy.title, version: copy.version })}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {open ? (
        <CopyDialog
          orderId={orderId}
          kind={open}
          onClose={() => {
            setOpen(null)
          }}
        />
      ) : null}
    </SectionCard>
  )
}
