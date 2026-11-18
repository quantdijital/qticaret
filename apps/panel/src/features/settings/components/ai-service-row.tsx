import { Loader2, MoreHorizontal, Pencil, PlugZap, Trash2 } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { HiddenHint, InfoTip } from "@qticaret/admin-ui/patterns/info-tip"
import { Badge } from "@qticaret/admin-ui/ui/badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import { TableCell, TableRow } from "@qticaret/admin-ui/ui/table"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { AiServiceView } from "@/features/ai/api/ai"
import { useCan } from "@/features/auth/api/staff"
import { useAccountActions } from "@/features/settings/account-actions"
import type { AccountState } from "@/features/settings/api/payments"
import { AccountBadges } from "@/features/settings/components/account-badges"
import { AiKeyDialog } from "@/features/settings/components/ai-key-dialog"

const C = "ai.card"
/** Where a service's own texts live (`ai.services.<id>`): its name, its refusals. */
const NS = "ai.services"
/** The columns a note under the row spans (as many as `AiServicesTable` has). */
const AI_SERVICE_COLUMNS = 5

/**
 * Below `sm` the row is a small card: the name and what it can do, the
 * (i) and the button beside them, the state under the name. The table's
 * columns do not fit a phone without scrolling sideways.
 */
const PHONE_ROW =
  "max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto_auto] max-sm:items-center max-sm:gap-x-3 max-sm:gap-y-1.5 max-sm:px-5 max-sm:py-2.5"

/** The service's state in the words every provider account uses. */
const stateOf = (status: AiServiceView["status"]): AccountState =>
  status === "not_connected" ? "not_configured" : status

/**
 * One AI service on Settings > Yapay zekâ (adr/0071 §13) as a table row:
 * its name, what it can do, where its data goes behind an (i), its state,
 * and "Bağla" or a menu with "Anahtarı değiştir" / "Bağlantıyı test et" /
 * "Kaldır". The owner connects and removes (`accounts`); the admin may
 * test what is stored; everyone on the page sees the state. With the
 * package leaving the shop's own key out, a stored key stays but nothing
 * can be connected or tested. What needs doing (a refusal, a key to
 * enter again) goes in a line under the row.
 */
export function AiServiceRow({
  service,
  ownKeys,
  keyConfigured,
}: {
  service: AiServiceView
  /** The package's `ai.own_keys`. */
  ownKeys: boolean
  /** Whether the server can seal a key at all (the provider accounts' `key_configured`). */
  keyConfigured: boolean
}) {
  const { t } = useTranslation()
  const mayChange = useCan("accounts")
  const name = t(`${NS}.${service.id}.name`, { defaultValue: service.id })
  const actions = useAccountActions(service.id, name, NS)
  const [editing, setEditing] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const hintId = useId()
  const state = stateOf(service.status)
  const stored = state !== "not_configured" && state !== "unreadable"
  const removable = mayChange && state !== "not_configured"
  const { busy } = actions
  const capabilities = service.capabilities.map((c) => t(`ai.capabilities.${c}`))

  // What to do about it, in a line under the row (the key missing on the server is the page's)
  const note = !ownKeys
    ? stored
      ? t(`${C}.keptUnused`)
      : null
    : !keyConfigured
      ? null
      : state === "unreadable"
        ? t("settings.payments.account.unreadable")
        : state === "rejected"
          ? t(`${NS}.${service.id}.rejected`)
          : null
  const failure = actions.failure && !editing ? actions.failure : null
  const below = note !== null || failure !== null

  return (
    <>
      <TableRow className={cn("sm:h-14", PHONE_ROW, below ? "border-b-0" : "")}>
        <TableCell className="w-full max-w-0 py-2 pl-5 max-sm:col-start-1 max-sm:row-start-1 max-sm:w-auto max-sm:max-w-none max-sm:p-0">
          <div className="truncate font-medium">{name}</div>
          <div className="hidden truncate text-[13px] text-muted-foreground xl:block">
            {t(`${NS}.${service.id}.description`, { defaultValue: "" })}
          </div>
          {/* Narrower: what it can do in words, the badges' column is gone */}
          <div className="text-[13px] text-muted-foreground max-sm:whitespace-normal sm:truncate xl:hidden">
            {capabilities.join(" · ")}
          </div>
        </TableCell>
        <TableCell className="hidden py-2 xl:table-cell">
          <ul className="flex gap-1" aria-label={t(`${C}.columns.capabilities`)}>
            {capabilities.map((label) => (
              <li key={label}>
                <Badge variant="secondary">{label}</Badge>
              </li>
            ))}
          </ul>
        </TableCell>
        <TableCell className="py-2 text-center max-sm:col-start-2 max-sm:row-start-1 max-sm:p-0">
          <InfoTip
            name={t(`${C}.dataFor`, { name })}
            hintId={hintId}
            hint={
              <span className="flex flex-col gap-1.5">
                <span>{t(service.data_note_key, { defaultValue: "" })}</span>
                <span>{t(`${C}.noPersonalData`)}</span>
              </span>
            }
          />
          <HiddenHint id={hintId}>
            {t(service.data_note_key, { defaultValue: "" })} {t(`${C}.noPersonalData`)}
          </HiddenHint>
        </TableCell>
        <TableCell className="py-2 max-sm:col-start-1 max-sm:row-start-2 max-sm:p-0">
          <div className="flex flex-wrap gap-1">
            <AccountBadges account={{ ...EMPTY, provider: service.id, state }} name={name} />
          </div>
        </TableCell>
        <TableCell className="py-2 pr-5 text-right max-sm:col-start-3 max-sm:row-span-2 max-sm:row-start-1 max-sm:p-0">
          <div className="flex items-center justify-end gap-1">
            {mayChange && !stored ? (
              <Button
                size="sm"
                disabled={busy || !ownKeys || !keyConfigured}
                onClick={() => {
                  setEditing(true)
                }}
              >
                {t(`${C}.connect`)}
              </Button>
            ) : null}
            {stored || removable ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy}
                    aria-label={t(`${C}.actionsFor`, { name })}
                  >
                    {busy ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {mayChange && stored ? (
                    <DropdownMenuItem
                      disabled={!ownKeys || !keyConfigured}
                      onSelect={() => {
                        setEditing(true)
                      }}
                    >
                      <Pencil />
                      {t(`${C}.change`)}
                    </DropdownMenuItem>
                  ) : null}
                  {stored ? (
                    <DropdownMenuItem disabled={!ownKeys} onSelect={actions.test}>
                      <PlugZap />
                      {t(`${C}.test`)}
                    </DropdownMenuItem>
                  ) : null}
                  {removable ? (
                    <>
                      {stored ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => {
                          setConfirmRemove(true)
                        }}
                      >
                        <Trash2 />
                        {t(`${C}.remove`)}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
          {editing ? (
            <AiKeyDialog
              service={service.id}
              name={name}
              dataNoteKey={service.data_note_key}
              stored={stored}
              actions={actions}
              onClose={() => {
                setEditing(false)
              }}
            />
          ) : null}
          <ConfirmDialog
            open={confirmRemove}
            onOpenChange={setConfirmRemove}
            title={t(`${C}.removeTitle`, { name })}
            description={t(`${C}.removeDescription`, { name })}
            confirmLabel={t(`${C}.remove`)}
            destructive
            onConfirm={actions.disconnect}
          />
        </TableCell>
      </TableRow>
      {below ? (
        <TableRow className="hover:bg-transparent max-sm:block">
          <TableCell
            colSpan={AI_SERVICE_COLUMNS}
            className="px-5 pt-0 pb-2.5 text-[13px] whitespace-normal max-sm:block"
          >
            {note ? <p className="text-muted-foreground">{note}</p> : null}
            {failure ? (
              <p role="alert" className="text-destructive-text">
                {failure}
              </p>
            ) : null}
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}

/** The rest of a provider account the badge does not read. */
const EMPTY = {
  settings: null,
  secrets: {},
  secrets_version: 0,
  verified_at: null,
  updated_at: null,
}
