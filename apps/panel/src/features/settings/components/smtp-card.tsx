import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Send } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Alert, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { useCan } from "@/features/auth/api/staff"
import { useAccountActions } from "@/features/settings/account-actions"
import { senderDomainQuery, sendSmtpTest } from "@/features/settings/api/messaging"
import type { SmtpTestResult } from "@/features/settings/api/messaging"
import { providerAccountsQuery } from "@/features/settings/api/payments"
import type { SmtpAccount } from "@/features/settings/api/payments"
import { AccountAlert } from "@/features/settings/components/account-form"
import { AccountBadges } from "@/features/settings/components/account-badges"
import { SmtpDialog } from "@/features/settings/components/smtp-dialog"
import { nothingStored } from "@/features/settings/payments"
import { errorText } from "@/lib/errors"
import { toast } from "sonner"

const N = "settings.notifications"
const S = `${N}.smtp`

/** The test's answer in words: sent to whom, or why not and the server's reply code. */
function TestAnswer({ result }: { result: SmtpTestResult }) {
  const { t } = useTranslation()
  if (result.ok) {
    return (
      <Alert>
        <AlertDescription>{t(`${S}.test.sent`, { to: result.to })}</AlertDescription>
      </Alert>
    )
  }
  const known = t(`${S}.test.reasons.${result.reason}`, { defaultValue: "" })
  return (
    <Alert variant="destructive">
      <AlertDescription>
        <span>{known || t(`${S}.test.reasons.failed`)}</span>
        {result.reply ? (
          <span className="block text-xs">{t(`${S}.test.reply`, { reply: result.reply })}</span>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

/**
 * Settings > Messages > E-posta: "E-posta gönderimi" (adr/0036 Ek
 * 2026-11-10). The shop's own mail server (SMTP): when saved, every e-mail
 * goes through it; without it, through the platform's service as before.
 * The owner sets it up; the owner and the admin may send a test to their
 * own address. Staff who cannot read the accounts do not see the card.
 */
export function SmtpCard() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const query = useQuery(providerAccountsQuery())
  const mayChange = useCan("accounts")
  const name = t(`${S}.name`)
  const actions = useAccountActions("smtp", name, N)
  const [editing, setEditing] = useState(false)
  const [answer, setAnswer] = useState<SmtpTestResult | null>(null)
  const test = useMutation({
    mutationFn: sendSmtpTest,
    onMutate: () => {
      setAnswer(null)
    },
    onSuccess: setAnswer,
    // Not the server's answer: ours (nothing saved, too many tries)
    onError: (failure) => {
      toast.error(errorText(t, failure))
    },
  })
  if (query.isError) {
    return null
  }
  const account = query.data?.accounts.find((each) => each.provider === "smtp") as
    SmtpAccount | undefined
  const stored = !nothingStored(account)
  const settings = account?.settings
  const close = () => {
    setEditing(false)
    // The sender and its records follow the account
    void client.invalidateQueries({ queryKey: senderDomainQuery().queryKey })
  }

  return (
    <SectionCard
      title={t(`${S}.title`)}
      description={t(`${S}.description`)}
      action={query.data ? <AccountBadges account={account} name={name} /> : undefined}
    >
      {!query.data ? (
        <Skeleton className="h-16" />
      ) : (
        <div className="flex flex-col gap-4">
          <AccountAlert
            provider="smtp"
            state={account?.state ?? "not_configured"}
            keyConfigured={query.data.key_configured}
            ns={N}
          />
          {stored && settings ? (
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
              <dt className="text-muted-foreground">{t(`${S}.server`)}</dt>
              <dd className="font-mono break-all">
                {settings.host}:{settings.port} · {t(`${S}.securities.${settings.security}`)}
              </dd>
              <dt className="text-muted-foreground">{t(`${S}.sender`)}</dt>
              <dd className="break-all">
                {settings.from_name ? `${settings.from_name} · ` : ""}
                <span className="font-mono">{settings.from_email}</span>
              </dd>
              <dt className="text-muted-foreground">{t(`${S}.pace`)}</dt>
              <dd>{t(`${S}.paceValue`, { count: settings.rate_per_minute })}</dd>
            </dl>
          ) : (
            <p className="text-[13px] text-muted-foreground">{t(`${S}.none`)}</p>
          )}
          {answer ? <TestAnswer result={answer} /> : null}
          <div className="flex flex-wrap justify-end gap-2">
            {stored ? (
              <Button
                variant="outline"
                disabled={test.isPending || account?.state === "unreadable"}
                onClick={() => {
                  test.mutate()
                }}
              >
                {test.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                {t(`${S}.test.button`)}
              </Button>
            ) : null}
            {mayChange ? (
              <Button
                disabled={!query.data.key_configured || actions.busy}
                onClick={() => {
                  setEditing(true)
                }}
              >
                {t(stored ? `${S}.edit` : `${S}.connect`)}
              </Button>
            ) : null}
          </div>
        </div>
      )}
      {editing ? (
        <SmtpDialog account={account} actions={actions} name={name} onClose={close} />
      ) : null}
    </SectionCard>
  )
}
