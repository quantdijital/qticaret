import { Check, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDecideAddress } from "@/features/settings/api/migration"
import type { OldAddress } from "@/features/settings/api/migration"
import { errorText } from "@/lib/errors"
import { formatCount } from "@/lib/format"

const A = "settings.migration.addresses"
const STATE_TONES: Readonly<Record<OldAddress["state"], StatusTone>> = {
  live: "success",
  redirected: "success",
  gone: "neutral",
  not_found: "danger",
}
const ACTION_TONES: Readonly<Record<OldAddress["action"], StatusTone>> = {
  covered: "success",
  reserve: "info",
  redirect: "info",
  gone: "neutral",
  undecided: "warning",
  unsupported: "warning",
}

/** The owner's word on one address: a 301 to a page here, a 410, or back to its record's. */
function Decision({ row }: { row: OldAddress }) {
  const { t } = useTranslation()
  const decide = useDecideAddress()
  const [decision, setDecision] = useState(row.decision)
  const [target, setTarget] = useState(row.target ?? "")
  const changed =
    decision !== row.decision || (decision === "redirect" && target !== (row.target ?? ""))
  return (
    <div className="flex min-w-[16rem] flex-wrap items-center gap-2">
      <Select
        value={decision}
        onValueChange={(next) => {
          setDecision(next as OldAddress["decision"])
        }}
      >
        <SelectTrigger className="h-8 w-36" aria-label={t(`${A}.columns.action`)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">{t(`${A}.decide.auto`)}</SelectItem>
          <SelectItem value="redirect">{t(`${A}.decide.redirect`)}</SelectItem>
          <SelectItem value="gone">{t(`${A}.decide.gone`)}</SelectItem>
        </SelectContent>
      </Select>
      {decision === "redirect" ? (
        <Input
          className="h-8 w-44"
          placeholder="/urun/yeni-adres"
          aria-label={t(`${A}.decide.target`)}
          value={target}
          onChange={(event) => {
            setTarget(event.target.value)
          }}
        />
      ) : null}
      <Button
        size="sm"
        variant="outline"
        disabled={!changed || decide.isPending || (decision === "redirect" && !target.trim())}
        onClick={() => {
          decide.mutate(
            decision === "redirect"
              ? { id: row.id, decision, target: target.trim() }
              : { id: row.id, decision },
            {
              onSuccess: () => toast.success(t(`${A}.decide.saved`)),
              onError: (failure) => toast.error(errorText(t, failure)),
            }
          )
        }}
      >
        {decide.isPending ? <Loader2 className="animate-spin" /> : <Check />}
        {t(`${A}.decide.save`)}
      </Button>
    </div>
  )
}

/** One old address: its clicks, what it answers today, what an apply does, and the owner's word. */
export function AddressRow({ row }: { row: OldAddress }) {
  const { t } = useTranslation()
  return (
    <tr className="border-t align-middle">
      <td className="max-w-[22rem] px-3 py-2">
        <span className="block truncate font-mono text-[13px]" title={row.address}>
          {row.address}
        </span>
        {row.location ? (
          <span className="block truncate text-[12px] text-muted-foreground">→ {row.location}</span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.clicks ?? 0)}</td>
      <td className="px-3 py-2">
        <StatusBadge tone={STATE_TONES[row.state]}>{t(`${A}.states.${row.state}`)}</StatusBadge>
      </td>
      <td className="px-3 py-2">
        <StatusBadge tone={ACTION_TONES[row.action]}>{t(`${A}.actions.${row.action}`)}</StatusBadge>
      </td>
      <td className="px-3 py-2">{row.action === "covered" ? null : <Decision row={row} />}</td>
    </tr>
  )
}
