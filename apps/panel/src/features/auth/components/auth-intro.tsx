import { Megaphone, ShieldCheck, Tags, Truck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

// What the panel does, one line each (keys under `login.intro`)
const POINTS: { key: string; icon: LucideIcon }[] = [
  { key: "orders", icon: Truck },
  { key: "catalog", icon: Tags },
  { key: "marketing", icon: Megaphone },
  { key: "security", icon: ShieldCheck },
]

/**
 * The product beside the sign-in pages (the owner, 2026-11-04): its name,
 * one promise and what it does, on the menu's own surface (the shop's
 * sidebar colours, which the theme engine keeps readable). Below `lg`
 * only the name and the promise, as a strip above the form. Nothing here
 * takes focus. Only the platform's name: before sign-in the panel cannot
 * read the shop's name or logo (both are behind `/admin`).
 */
export function AuthIntro({ className }: { className?: string }) {
  const { t } = useTranslation()
  const product = t("app.product")
  return (
    <aside
      aria-label={product}
      className={cn(
        "relative isolate overflow-hidden bg-sidebar text-sidebar-foreground lg:border-r lg:border-sidebar-border",
        className
      )}
    >
      <div aria-hidden="true" className="qt-auth-lines absolute inset-0 -z-10" />
      <div aria-hidden="true" className="qt-auth-wash absolute inset-0 -z-10 hidden lg:block" />
      <div className="flex h-full flex-col gap-12 px-6 py-4 sm:px-10 lg:justify-between lg:p-12 xl:p-16">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-base font-semibold text-sidebar-primary-foreground"
          >
            {product.slice(0, 1)}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-sm font-semibold lg:text-base">{product}</p>
            <p className="text-[13px] text-sidebar-muted-foreground lg:hidden">
              {t("login.intro.promise")}
            </p>
          </div>
        </div>
        <div className="hidden max-w-lg flex-col gap-10 lg:flex">
          <p className="text-[28px] leading-tight font-semibold tracking-tight text-balance">
            {t("login.intro.promise")}
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
                  <p className="text-sm font-medium">{t(`login.intro.${key}.title`)}</p>
                  <p className="text-[13px] leading-5 text-sidebar-muted-foreground">
                    {t(`login.intro.${key}.text`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="hidden text-xs text-sidebar-muted-foreground lg:block">
          {t("login.intro.footer")}
        </p>
      </div>
    </aside>
  )
}
