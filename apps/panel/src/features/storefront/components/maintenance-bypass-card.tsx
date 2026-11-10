import { Check, Copy, Link2, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useBypassLink } from "@/features/storefront/api/maintenance"
import type { BypassLink } from "@/features/storefront/api/maintenance"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"

const B = "storefront.maintenance.bypass"

interface BypassCardProps {
  /** Maintenance is on as saved: a link is only made then. */
  enabled: boolean
  /** The section's stored version: a save after the link was made ends it. */
  version: number
  /** Owner and admin (adr/0053 §A.2); the others see what it is for. */
  canCreate: boolean
}

/** The link with its copy button, and until when it works. */
function LinkRow({ link }: { link: BypassLink }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="maintenance-bypass-url" className="text-sm font-medium">
        {t(`${B}.link`)}
      </label>
      <div className="flex items-center gap-2">
        <Input
          id="maintenance-bypass-url"
          readOnly
          value={link.url}
          className="font-mono text-[13px]"
          onFocus={(event) => {
            event.currentTarget.select()
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t(`${B}.copy`)}
          onClick={() => {
            // Refused without the page's clipboard permission: the field stays selectable
            navigator.clipboard.writeText(link.url).then(
              () => {
                setCopied(true)
                toast.success(t(`${B}.copied`))
              },
              () => toast.error(t(`${B}.copyFailed`))
            )
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t(`${B}.expires`, { date: formatDateTime(link.expires_at) })}
      </p>
    </div>
  )
}

/**
 * "Bakım modunu atlatma bağlantısı" (adr/0053 §A.4): a link that shows the
 * dark shop to whoever holds it, for a week and until the section is saved
 * again. Nothing is stored: the link shows here until the page is left.
 */
export function MaintenanceBypassCard({ enabled, version, canCreate }: BypassCardProps) {
  const { t } = useTranslation()
  const create = useBypassLink()
  const [made, setMade] = useState<{ link: BypassLink; version: number } | null>(null)
  // A save since it was made ended it
  const link = made?.version === version && enabled ? made.link : null
  let note: string | null = null
  if (!canCreate) {
    note = t(`${B}.noRight`)
  } else if (!enabled) {
    note = t(`${B}.notEnabled`)
  }
  return (
    <SectionCard
      title={t(`${B}.title`)}
      description={t(`${B}.description`)}
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!enabled || !canCreate || create.isPending}
          onClick={() => {
            create.mutate(undefined, {
              onSuccess: (next) => {
                setMade({ link: next, version })
              },
            })
          }}
        >
          {create.isPending ? <Loader2 className="animate-spin" /> : <Link2 />}
          {t(link ? `${B}.again` : `${B}.create`)}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {note ? <p className="text-[13px] text-muted-foreground">{note}</p> : null}
        {create.isError ? (
          <p role="alert" className="text-[13px] text-destructive-text">
            {errorText(t, create.error)}
          </p>
        ) : null}
        {link ? <LinkRow link={link} /> : null}
        <p className="rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning-text">
          {t(`${B}.ends`)}
        </p>
      </div>
    </SectionCard>
  )
}
