import { Link } from "@tanstack/react-router"
import { ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionCard } from "@/components/patterns/section-card"
import { useCapabilities } from "@/features/auth/api/staff"
import { visibleGroups } from "@/features/settings/sections"

/**
 * Settings' first page: every section in its group, each a link with a
 * line on what it holds, so the shop finds a setting by its subject.
 */
export function SettingsHomePage() {
  const { t } = useTranslation()
  const groups = visibleGroups(useCapabilities())
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("settings.home.title")} description={t("settings.home.description")} />
      {/* One card per group across the page, its links two by two: no card is left half empty */}
      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <SectionCard key={group.key} title={t(`settings.groups.${group.key}`)} flush>
            <ul className="grid lg:grid-cols-2">
              {group.sections.map((section) => {
                const Icon = section.icon
                return (
                  <li
                    key={section.key}
                    className="border-t lg:odd:border-r lg:[&:last-child:nth-child(odd)]:col-span-2 lg:[&:last-child:nth-child(odd)]:border-r-0"
                  >
                    <Link
                      to={section.to}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-muted/60"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Icon aria-hidden className="size-4 text-muted-foreground" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-medium">
                          {t(`settings.sections.${section.key}`)}
                        </span>
                        <span className="text-[13px] text-muted-foreground">
                          {t(`settings.sectionHints.${section.key}`)}
                        </span>
                      </span>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </SectionCard>
        ))}
      </div>
    </div>
  )
}
