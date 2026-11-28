import { Copy } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@qticaret/admin-ui/ui/button"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import type { Domain, DomainDns } from "@/features/tenants/api"
import { isVerified } from "@/features/tenants/api"

function CopyValue({ value, label }: { value: string; label: string }) {
  const { t } = useTranslation()
  return (
    <span className="flex min-w-0 items-start gap-1">
      <code className="min-w-0 font-mono text-xs break-all">{value}</code>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-6 shrink-0"
        aria-label={t("domains.dns.copy", { what: label })}
        onClick={() => {
          navigator.clipboard.writeText(value).then(
            () => toast.success(t("domains.dns.copied")),
            () => toast.error(t("common.copyFailed"))
          )
        }}
      >
        <Copy aria-hidden="true" />
      </Button>
    </span>
  )
}

function DnsRecord({ type, name, values }: { type: string; name: string; values: string[] }) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-x-3 gap-y-1.5 rounded-md border p-3 text-sm sm:grid-cols-[4.5rem_minmax(0,1fr)]">
      <span className="text-[13px] text-muted-foreground">{t("domains.dns.type")}</span>
      <span className="font-mono text-xs">{type}</span>
      <span className="text-[13px] text-muted-foreground">{t("domains.dns.name")}</span>
      <CopyValue value={name} label={t("domains.dns.name")} />
      <span className="text-[13px] text-muted-foreground">{t("domains.dns.value")}</span>
      <span className="flex min-w-0 flex-col gap-1">
        {values.map((value) => (
          <CopyValue key={value} value={value} label={t("domains.dns.value")} />
        ))}
      </span>
    </div>
  )
}

/**
 * What the shop's owner publishes for a custom domain (F16.7): the TXT
 * record that proves it, then where it points (once the server exists);
 * the last check's reason, and TLS honestly left to the server (F16).
 */
export function DomainDnsPanel({ domain, dns }: { domain: Domain; dns: DomainDns }) {
  const { t } = useTranslation()
  const reason = domain.verification_error
  return (
    <section className="flex flex-col gap-3" aria-label={t("domains.dns.title")}>
      <h3 className="text-sm font-medium">{t("domains.dns.title")}</h3>
      <p className="text-[13px] text-muted-foreground">{t("domains.dns.txtText")}</p>
      <DnsRecord type="TXT" name={dns.txt.name} values={[dns.txt.value]} />
      {dns.routing ? (
        <>
          <p className="text-[13px] text-muted-foreground">
            {t(dns.routing.type === "CNAME" ? "domains.dns.cnameText" : "domains.dns.aText")}
          </p>
          <DnsRecord type={dns.routing.type} name={dns.routing.name} values={dns.routing.values} />
        </>
      ) : (
        <p className="text-[13px] text-muted-foreground">{t("domains.dns.routingLater")}</p>
      )}
      {reason ? (
        <p
          role="status"
          className={
            isVerified(domain)
              ? "text-[13px] text-muted-foreground"
              : "text-[13px] text-destructive"
          }
        >
          {t(`domains.reasons.${reason}`)}
        </p>
      ) : null}
      <dl className="grid gap-x-5 gap-y-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
        <dt className="text-[13px] text-muted-foreground">{t("domains.lastChecked")}</dt>
        <dd>
          {domain.last_checked_at ? formatDateTime(domain.last_checked_at) : t("domains.never")}
        </dd>
        <dt className="text-[13px] text-muted-foreground">{t("domains.ssl")}</dt>
        <dd>{t("domains.sslLater")}</dd>
      </dl>
    </section>
  )
}
