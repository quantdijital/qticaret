import { useTranslation } from "react-i18next"
import { formatDateTime, formatRelative } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { LastBackup } from "@/features/tenants/api"

/** A shop's latest backup in one short line for the list (audit 3.2). */
export function BackupLine({ backup }: { backup: LastBackup | null }) {
  const { t } = useTranslation()
  if (!backup) {
    return <span className="text-xs text-muted-foreground">{t("backup.list.none")}</span>
  }
  const ok = backup.status === "succeeded"
  return (
    <span
      title={formatDateTime(backup.at)}
      className={cn("text-xs", ok ? "text-muted-foreground" : "text-destructive")}
    >
      {ok ? t("backup.list.ok", { when: formatRelative(backup.at) }) : t("backup.list.failed")}
    </span>
  )
}
