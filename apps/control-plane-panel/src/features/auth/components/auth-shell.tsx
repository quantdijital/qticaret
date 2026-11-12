import { KeyRound, ScrollText, ShieldCheck, Store } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"

// What the control plane is for, one line each (keys under `auth.intro`)
const POINTS: { key: string; icon: LucideIcon }[] = [
  { key: "shops", icon: Store },
  { key: "access", icon: KeyRound },
  { key: "audit", icon: ScrollText },
  { key: "security", icon: ShieldCheck },
]

/**
 * Beside the pages before the panel (the shop panel's sign-in layout,
 * docs/18 §3 "Giriş sayfaları istisnası"): the platform's name, one
 * sentence and what the control plane is for, on the menu's surface.
 * Below `lg` only the name and the sentence, as a strip. Nothing takes focus.
 */
function AuthIntro({ className }: { className?: string }) {
  const { t } = useTranslation()
  const product = t("app.product")
  return (
    <aside
      aria-label={t("app.name")}
      className={cn(
        "relative isolate overflow-hidden bg-sidebar text-sidebar-foreground lg:border-r lg:border-sidebar-border",
        className
      )}
    >
      <div aria-hidden="true" className="qt-auth-lines absolute inset-0 -z-10" />
      <div className="flex h-full flex-col gap-12 px-6 py-4 sm:px-10 lg:justify-between lg:p-12 xl:p-16">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-base font-semibold text-sidebar-primary-foreground"
          >
            {product.slice(0, 1)}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-sm font-semibold lg:text-base">{t("app.name")}</p>
            <p className="text-[13px] text-sidebar-muted-foreground">{product}</p>
          </div>
        </div>
        <div className="hidden max-w-lg flex-col gap-10 lg:flex">
          <p className="text-[28px] leading-tight font-semibold tracking-tight text-balance">
            {t("auth.intro.promise")}
          </p>
          <ul className="flex flex-col gap-6">
            {POINTS.map(({ key, icon: Icon }) => (
              <li key={key} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent/50 text-sidebar-primary"
                >
                  <Icon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-sm font-medium">{t(`auth.intro.${key}.title`)}</p>
                  <p className="text-[13px] leading-5 text-sidebar-muted-foreground">
                    {t(`auth.intro.${key}.text`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="hidden text-xs text-sidebar-muted-foreground lg:block">
          {t("auth.intro.footer")}
        </p>
      </div>
    </aside>
  )
}

/**
 * The pages before the panel: sign-in, an invitation, 2FA setup, no
 * access. The "Üst panel" bar on top; from `lg` two columns, the form's
 * box first in the document (keyboard and screen reader reach it first).
 */
export function AuthShell({
  children,
  after,
  wide = false,
}: {
  children: ReactNode
  /** A line under the box, outside it. */
  after?: ReactNode
  /** The 2FA setup's QR code and key need more room than a form. */
  wide?: boolean
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <div className="grid flex-1 grid-rows-[auto_1fr] lg:grid-cols-2 lg:grid-rows-1">
        <main className="flex items-start justify-center px-6 pt-10 pb-6 sm:items-center sm:px-10 sm:py-10 lg:px-12">
          <div className={cn("flex w-full flex-col gap-6", wide ? "max-w-lg" : "max-w-sm")}>
            <div className="sm:rounded-xl sm:bg-card sm:p-8">{children}</div>
            {after}
          </div>
        </main>
        <AuthIntro className="order-first" />
      </div>
    </div>
  )
}

/** The box's title and its one sentence. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-[22px] leading-tight font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}
