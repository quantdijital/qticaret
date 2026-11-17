import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Badge } from "@qticaret/admin-ui/ui/badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { AiServiceView } from "@/features/ai/api/ai"
import { useCan } from "@/features/auth/api/staff"
import { useAccountActions } from "@/features/settings/account-actions"
import type { AccountState } from "@/features/settings/api/payments"
import { AccountAlert } from "@/features/settings/components/account-form"
import { AccountBadges } from "@/features/settings/components/account-badges"
import { AiDataNote } from "@/features/settings/components/ai-data-note"
import { AiKeyDialog } from "@/features/settings/components/ai-key-dialog"

const C = "ai.card"
/** Where a service's own texts live (`ai.services.<id>`): its name, its refusals. */
const NS = "ai.services"

/** The service's state in the words every provider account uses. */
const stateOf = (status: AiServiceView["status"]): AccountState =>
  status === "not_connected" ? "not_configured" : status

/**
 * One AI service on Settings > Yapay zekâ (adr/0071 §13): its name, what
 * it can do, its state, where its data goes, and "Bağla" / "Anahtarı
 * değiştir" / "Bağlantıyı dene" / "Kaldır". The owner connects and
 * removes (`accounts`); the admin may test what is stored; everyone on
 * the page sees the state. With the package leaving the shop's own key
 * out, a stored key stays but nothing can be connected or tested.
 */
export function AiServiceCard({
  service,
  ownKeys,
  keyConfigured,
  className,
}: {
  service: AiServiceView
  /** The package's `ai.own_keys`. */
  ownKeys: boolean
  /** Whether the server can seal a key at all (the provider accounts' `key_configured`). */
  keyConfigured: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const mayChange = useCan("accounts")
  const name = t(`${NS}.${service.id}.name`, { defaultValue: service.id })
  const actions = useAccountActions(service.id, name, NS)
  const [editing, setEditing] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const state = stateOf(service.status)
  const stored = state !== "not_configured" && state !== "unreadable"
  const { busy } = actions

  return (
    <SectionCard
      title={name}
      description={t(`${NS}.${service.id}.description`, { defaultValue: "" })}
      action={<AccountBadges account={{ ...EMPTY, provider: service.id, state }} name={name} />}
      className={className}
    >
      <div className="flex h-full flex-col gap-4">
        {/* Wide: what it does and its state beside where the data goes */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <ul className="flex flex-wrap gap-1.5" aria-label={t(`${C}.capabilities`)}>
              {service.capabilities.map((capability) => (
                <li key={capability}>
                  <Badge variant="secondary">{t(`ai.capabilities.${capability}`)}</Badge>
                </li>
              ))}
            </ul>
            {ownKeys ? (
              <AccountAlert
                provider={service.id}
                state={state}
                keyConfigured={keyConfigured}
                ns={NS}
              />
            ) : stored ? (
              <p className="text-[13px] text-muted-foreground">{t(`${C}.keptUnused`)}</p>
            ) : null}
            {mayChange ? null : (
              <p className="text-[13px] text-muted-foreground">{t(`${C}.ownerConnects`)}</p>
            )}
          </div>
          <AiDataNote dataNoteKey={service.data_note_key} name={name} />
        </div>
        {actions.failure && !editing ? (
          <p role="alert" className="text-sm text-destructive-text">
            {actions.failure}
          </p>
        ) : null}
        {/* Nothing to press (not the owner, nothing stored): no empty footer */}
        <div
          className={`mt-auto flex flex-wrap items-center justify-end gap-2 border-t pt-4 ${mayChange || stored ? "" : "hidden"}`}
        >
          {mayChange && state !== "not_configured" ? (
            <Button
              variant="ghost"
              className="text-destructive-text sm:mr-auto"
              disabled={busy}
              onClick={() => {
                setConfirmRemove(true)
              }}
            >
              {t(`${C}.remove`)}
            </Button>
          ) : null}
          {stored ? (
            <Button variant="outline" disabled={busy || !ownKeys} onClick={actions.test}>
              {actions.check.isPending ? <Loader2 className="animate-spin" /> : null}
              {t(`${C}.test`)}
            </Button>
          ) : null}
          {mayChange ? (
            <Button
              variant={stored ? "outline" : "default"}
              disabled={busy || !ownKeys || !keyConfigured}
              onClick={() => {
                setEditing(true)
              }}
            >
              {t(stored ? `${C}.change` : `${C}.connect`)}
            </Button>
          ) : null}
        </div>
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
    </SectionCard>
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
