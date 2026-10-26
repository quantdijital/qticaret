import { Link, Outlet, useRouterState } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

// Sections grow with the slices (docs/03 P2+: shipping, payments, users...)
const SECTIONS = [
  { key: "store", to: "/settings/store" },
  { key: "locations", to: "/settings/locations" },
  { key: "appearance", to: "/settings/appearance" },
  { key: "seo", to: "/settings/seo" },
  { key: "attributes", to: "/settings/attributes" },
  { key: "features", to: "/settings/features" },
  { key: "jobs", to: "/settings/jobs" },
  { key: "audit", to: "/settings/audit" },
] as const

/** Settings: a section list on the left, the section on the right. */
export function SettingsLayout() {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
      <nav aria-label={t("settings.title")} className="lg:w-56 lg:shrink-0">
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {SECTIONS.map((section) => (
            <li key={section.key}>
              <Link
                to={section.to}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm hover:bg-muted",
                  pathname.startsWith(section.to) && "bg-muted font-medium"
                )}
              >
                {t(`settings.sections.${section.key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
