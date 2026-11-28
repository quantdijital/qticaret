import { useNavigate } from "@tanstack/react-router"
import { LifeBuoy } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useLogout } from "@/features/auth/api/me"
import { useSupportSession } from "@/features/auth/api/staff"
import { minutesLeft } from "@/features/support-access/api"

const TICK_MS = 30_000

/**
 * Above every page for as long as a "Platform desteği" session lasts
 * (adr/0061 Ek "Destek erişimi", Karar 6): who came in, the minutes left,
 * and a way to end it now. At its end the panel signs out (the API
 * already refuses the session).
 */
export function SupportSessionBanner() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const support = useSupportSession()
  const [now, setNow] = useState(() => Date.now())
  const logout = useLogout(() => {
    void navigate({ to: "/login" })
  })
  useEffect(() => {
    if (!support) {
      return
    }
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, TICK_MS)
    return () => {
      window.clearInterval(timer)
    }
  }, [support])
  const left = support ? minutesLeft(support.expires_at, now) : null
  const { mutate, isPending } = logout
  useEffect(() => {
    if (left === 0 && !isPending) {
      mutate()
    }
  }, [left, isPending, mutate])
  if (!support || left === null) {
    return null
  }
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-info bg-info-soft px-4 py-2 text-[13px] text-info-text lg:px-[var(--page-padding-wide)]"
    >
      <LifeBuoy className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 font-medium">
        {t("supportAccess.banner.text", { name: support.operator_name })}
        <span className="font-normal"> · {t("supportAccess.banner.left", { count: left })}</span>
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-7"
        disabled={isPending}
        onClick={() => {
          mutate()
        }}
      >
        {t("supportAccess.banner.end")}
      </Button>
    </div>
  )
}
