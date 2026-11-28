import { Copy, ExternalLink } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"

/** The shop's own panel on this machine: its backend's port plus 1000 (Ek C10 I1). */
const localPanelPort = (port: number) => port + 1000

/**
 * Where a shop set up on this machine is managed (development only: the
 * local provisioner's): the shop's start runs its panel too (adr/0061 Ek
 * 2026-11-28, Karar 8), so "Paneli aç" opens it; the command stays for a
 * panel that did not come up (its port taken, a shop started before).
 * Nothing secret: a port and a command.
 */
export function LocalPanelCard({ port }: { port: number }) {
  const { t } = useTranslation()
  const panel = localPanelPort(port)
  const url = `http://localhost:${String(panel)}`
  const command = `PANEL_PORT=${String(panel)} PANEL_BACKEND_URL=http://localhost:${String(port)} pnpm --filter panel dev`
  const copy = () => {
    navigator.clipboard.writeText(command).then(
      () => toast.success(t("setup.local.copied")),
      () => toast.error(t("common.copyFailed"))
    )
  }
  return (
    <SectionCard title={t("setup.local.title")} description={t("setup.local.text")}>
      <dl className="flex flex-col gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <dt className="text-[13px] text-muted-foreground">{t("setup.local.address")}</dt>
          <dd className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button asChild size="sm">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                {t("setup.local.open")}
              </a>
            </Button>
            <span className="font-mono text-xs text-muted-foreground">{url}</span>
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-[13px] text-muted-foreground">{t("setup.local.commandFallback")}</dt>
          <dd className="flex items-start gap-2">
            <code className="min-w-0 flex-1 rounded-md bg-muted px-2 py-1.5 font-mono text-xs break-all">
              {command}
            </code>
            <Button size="icon" variant="outline" aria-label={t("setup.local.copy")} onClick={copy}>
              <Copy aria-hidden="true" />
            </Button>
          </dd>
        </div>
      </dl>
    </SectionCard>
  )
}
