import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ExternalLink, Loader2, PlugZap, Unplug } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import {
  parasutStatusQuery,
  useCheckParasut,
  useConnectParasut,
  useDisconnectParasut,
  useParasutOffered,
} from "@/features/settings/api/einvoice"
import type { InvoicingProvider } from "@/features/settings/api/einvoice"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"

const P = "settings.einvoice.parasut"

/**
 * The shop's Paraşüt company (adr/0034 §5): the owner allows the platform
 * on Paraşüt's page, copies the code it shows and pastes it here with the
 * company number. The shop's Paraşüt password never comes here.
 */
/** The company number and the pasted code: connects, or connects again. */
function ConnectForm({
  authorizeUrl,
  again,
  onDone,
}: {
  authorizeUrl: string | null
  again: boolean
  onDone: () => void
}) {
  const { t } = useTranslation()
  const connect = useConnectParasut()
  const [company, setCompany] = useState("")
  const [code, setCode] = useState("")
  return (
    <>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px] text-muted-foreground">
        <li>{t(`${P}.steps.open`)}</li>
        <li>{t(`${P}.steps.copy`)}</li>
        <li>{t(`${P}.steps.paste`)}</li>
      </ol>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t(`${P}.companyId`)} htmlFor="parasut-company">
          <Input
            id="parasut-company"
            inputMode="numeric"
            value={company}
            onChange={(event) => {
              setCompany(event.target.value)
            }}
          />
        </Field>
        <Field label={t(`${P}.code`)} htmlFor="parasut-code">
          <Input
            id="parasut-code"
            autoComplete="off"
            value={code}
            onChange={(event) => {
              setCode(event.target.value)
            }}
          />
        </Field>
      </div>
      <div className="mt-auto grid gap-2 sm:grid-cols-2">
        <Button variant="outline" asChild>
          <a href={authorizeUrl ?? "#"} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
            {t(`${P}.openParasut`)}
          </a>
        </Button>
        <Button
          disabled={connect.isPending || !company.trim() || !code.trim()}
          onClick={() => {
            connect.mutate(
              { company_id: company.trim(), code: code.trim() },
              {
                onSuccess: () => {
                  setCode("")
                  toast.success(t(`${P}.connected`))
                  onDone()
                },
                onError: (failure) => toast.error(errorText(t, failure)),
              }
            )
          }}
        >
          {connect.isPending ? <Loader2 className="animate-spin" /> : <PlugZap />}
          {t(again ? `${P}.reconnect` : `${P}.connect`)}
        </Button>
      </div>
    </>
  )
}

/**
 * The shop's Paraşüt company (adr/0034 §5): the owner allows the platform
 * on Paraşüt's page, copies the code it shows and pastes it here with the
 * company number. The shop's Paraşüt password never comes here. Once
 * connected, the form folds away behind "Connect again". Paraşüt is only
 * offered once the platform has opened it; a shop already on it when it is
 * off is told its invoices wait, and what it can choose instead.
 */
function ParasutConnection({ className }: { className?: string }) {
  const { t } = useTranslation()
  const status = useQuery(parasutStatusQuery())
  const disconnect = useDisconnectParasut()
  const check = useCheckParasut()
  const [editing, setEditing] = useState(false)
  const data = status.data
  const connection = data?.connection ?? null
  const fail = (failure: unknown) => toast.error(errorText(t, failure))
  const showForm = !connection || connection.status === "broken" || editing
  return (
    <SectionCard
      title={t(`${P}.title`)}
      description={t(`${P}.description`)}
      {...(className ? { className } : {})}
    >
      {!data ? (
        <Skeleton className="h-40 rounded-md" />
      ) : !data.available ? (
        <p className="text-[13px] text-muted-foreground">{t(`${P}.unavailable`)}</p>
      ) : (
        <div className="flex h-full flex-col gap-4">
          {connection ? (
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={connection.status === "connected" ? "success" : "danger"}>
                {t(`${P}.status.${connection.status}`)}
              </StatusBadge>
              <span className="text-sm">{t(`${P}.company`, { id: connection.company_id })}</span>
              <span className="text-xs text-muted-foreground">
                {t(`${P}.since`, { when: formatDateTime(connection.connected_at) })}
              </span>
            </div>
          ) : null}
          {connection?.status === "broken" ? (
            <p className="text-[13px] text-destructive-text">{t(`${P}.broken`)}</p>
          ) : null}
          {showForm ? (
            <ConnectForm
              authorizeUrl={data.authorize_url}
              again={connection !== null}
              onDone={() => {
                setEditing(false)
              }}
            />
          ) : (
            <>
              <p className="text-[13px] text-muted-foreground">{t(`${P}.working`)}</p>
              <div className="mt-auto grid gap-2 sm:grid-cols-3">
                <Button
                  variant="outline"
                  disabled={check.isPending}
                  onClick={() => {
                    check.mutate(undefined, {
                      onSuccess: (result) => {
                        if (result.ok) {
                          toast.success(t(`${P}.checkOk`))
                        } else {
                          toast.error(t(`${P}.checkFailed`, { code: result.code ?? "—" }))
                        }
                      },
                      onError: fail,
                    })
                  }}
                >
                  {check.isPending ? <Loader2 className="animate-spin" /> : null}
                  {t(`${P}.check`)}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(true)
                  }}
                >
                  <PlugZap />
                  {t(`${P}.reconnect`)}
                </Button>
                <Button
                  variant="outline"
                  disabled={disconnect.isPending}
                  onClick={() => {
                    disconnect.mutate(undefined, {
                      onSuccess: () => toast.success(t(`${P}.disconnected`)),
                      onError: fail,
                    })
                  }}
                >
                  <Unplug />
                  {t(`${P}.disconnect`)}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </SectionCard>
  )
}

/** The shop's own program: what it reads and writes back, with a key from Settings > API. */
function ExternalProgram({ className }: { className?: string }) {
  const { t } = useTranslation()
  const X = "settings.einvoice.external"
  return (
    <SectionCard
      title={t(`${X}.title`)}
      description={t(`${X}.description`)}
      {...(className ? { className } : {})}
    >
      <div className="flex h-full flex-col gap-3 text-[13px] text-muted-foreground">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>{t(`${X}.read`)}</li>
          <li>{t(`${X}.write`)}</li>
          <li>{t(`${X}.event`)}</li>
          <li>{t(`${X}.manual`)}</li>
        </ul>
        <div className="mt-auto">
          <Button variant="outline" asChild>
            <Link to="/settings/api">{t(`${X}.keys`)}</Link>
          </Button>
        </div>
      </div>
    </SectionCard>
  )
}

/** Nothing issued: what each program would do; Paraşüt once the platform has opened it. */
function NoProgram({ className }: { className?: string }) {
  const { t } = useTranslation()
  const parasut = useParasutOffered()
  const N = "settings.einvoice.none"
  return (
    <SectionCard
      title={t(`${N}.title`)}
      description={t(`${N}.description`)}
      {...(className ? { className } : {})}
    >
      <ul className="flex list-disc flex-col gap-2 pl-5 text-[13px] text-muted-foreground">
        {parasut ? <li>{t(`${N}.parasut`)}</li> : null}
        <li>{t(`${N}.external`)}</li>
        <li>{t(`${N}.manual`)}</li>
      </ul>
    </SectionCard>
  )
}

/** The card beside the program: its connection, or what the choice means. */
export function EinvoiceConnectionCard({
  provider,
  className,
}: {
  provider: InvoicingProvider
  className?: string
}) {
  if (provider === "parasut") {
    return <ParasutConnection {...(className ? { className } : {})} />
  }
  if (provider === "external") {
    return <ExternalProgram {...(className ? { className } : {})} />
  }
  return <NoProgram {...(className ? { className } : {})} />
}
