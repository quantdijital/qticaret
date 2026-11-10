import { useQuery } from "@tanstack/react-query"
import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { ORDER_KINDS, legalStarterQuery } from "@/features/legal/api"
import type { LegalDetail, LegalKind } from "@/features/legal/api"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"

const L = "settings.legal"

// The order's tokens, as the server lists them after the shop's
const ORDER_TOKENS = new Set([
  "alıcı_adı",
  "alıcı_e_posta",
  "alıcı_telefon",
  "teslimat_adresi",
  "fatura_adresi",
  "sipariş_no",
  "sipariş_tarihi",
  "sipariş_kalemleri",
  "ara_toplam",
  "kargo_ücreti",
  "indirim",
  "toplam",
  "ödeme_yöntemi",
])

function TokenRow({ token }: { token: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const written = `{${token}}`
  return (
    <li className="flex items-center gap-2 border-t px-5 py-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <code className="truncate font-mono text-xs">{written}</code>
        <span className="text-xs text-muted-foreground">{t(`${L}.tokens.names.${token}`)}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        aria-label={t(`${L}.tokens.copy`, { token: written })}
        onClick={() => {
          navigator.clipboard.writeText(written).then(
            () => {
              setCopied(true)
            },
            () => toast.error(t("settings.api.create.copyFailed"))
          )
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </li>
  )
}

/** The tokens the kind may use, to copy into the text: the shop's, and an order's in a contract. */
export function TokensCard({ kind }: { kind: LegalKind }) {
  const { t } = useTranslation()
  const query = useQuery(legalStarterQuery(kind))
  const tokens = query.data?.tokens ?? []
  const groups = [
    { key: "shop", tokens: tokens.filter((token) => !ORDER_TOKENS.has(token)) },
    ...(ORDER_KINDS.has(kind)
      ? [{ key: "order", tokens: tokens.filter((token) => ORDER_TOKENS.has(token)) }]
      : []),
  ]
  return (
    <SectionCard title={t(`${L}.tokens.title`)} description={t(`${L}.tokens.hint`)} flush>
      {query.isPending ? (
        <Skeleton className="mx-5 mb-5 h-40" />
      ) : (
        groups.map((group) => (
          <div key={group.key}>
            <p className="border-t px-5 pt-3 pb-1 text-xs font-medium text-muted-foreground">
              {t(`${L}.tokens.${group.key}`)}
            </p>
            <ul>
              {group.tokens.map((token) => (
                <TokenRow key={token} token={token} />
              ))}
            </ul>
          </div>
        ))
      )}
    </SectionCard>
  )
}

/** Every version published, newest first: which is in force and when each was published. */
export function VersionsCard({ history }: { history: LegalDetail["history"] }) {
  const { t } = useTranslation()
  return (
    <SectionCard title={t(`${L}.versions.title`)} flush>
      {history.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">{t(`${L}.versions.empty`)}</p>
      ) : (
        <ul>
          {history.map((row) => (
            <li key={row.id} className="flex items-center gap-3 border-t px-5 py-3 text-sm">
              <span className="w-10 font-medium tabular-nums">v{row.version}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {row.published_at ? formatDateTime(row.published_at) : "—"}
              </span>
              <StatusBadge tone={row.status === "published" ? "success" : "neutral"}>
                {t(`${L}.versions.${row.status}`)}
              </StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
