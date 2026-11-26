import { useQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { DayRange } from "@qticaret/admin-ui/patterns/day-range-filter"
import { FilterBar } from "@qticaret/admin-ui/patterns/filter-bar"
import type { FilterOption } from "@qticaret/admin-ui/patterns/filter-bar"
import { AUDIT_ACTOR_TYPES, auditResourceTypesQuery } from "@/features/settings/api/audit"
import type { AuditSearch } from "@/features/settings/api/audit"
import { teamQuery } from "@/features/settings/api/team"
import { groupResources } from "@/features/settings/audit-resources"

const F = "settings.audit.filters"

interface AuditFiltersProps {
  search: AuditSearch
  onChange: (next: Partial<AuditSearch>) => void
  /** Places the "Filtrele" button and the chips (`null` while nothing is set). */
  children: (parts: { trigger: ReactNode; chips: ReactNode }) => ReactNode
}

/**
 * Who, what and when (F12.5), above the log's table: the list's filter
 * bar (docs/18 §7), a "Filtrele" menu with chips under it; the page puts
 * the button at the end of its tabs (the log has no search to sit beside).
 * Every choice goes into the address.
 */
export function AuditFilters({ search, onChange, children }: AuditFiltersProps) {
  const { t } = useTranslation()
  const team = useQuery(teamQuery())
  const types = useQuery(auditResourceTypesQuery())
  const members = team.data?.staff ?? []
  const resources = types.data?.resource_types ?? []
  const actors: FilterOption[] = [
    ...members.map((member) => ({
      value: member.id,
      label: [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email,
      group: t(`${F}.people`),
    })),
    ...AUDIT_ACTOR_TYPES.map((type) => ({
      value: type,
      label: t(`settings.audit.actors.${type}`),
      group: t(`${F}.others`),
    })),
  ]
  const resourceOptions = groupResources(
    [
      ...resources,
      // Chosen from a shared link before the list arrived, or no longer listed
      ...(search.resource && !resources.includes(search.resource) ? [search.resource] : []),
    ],
    (type) => t(`settings.audit.resources.${type}`, { defaultValue: type })
  ).flatMap(({ group, options }) =>
    options.map(({ type, label }) => ({
      value: type,
      label,
      group: t(`${F}.groups.${group}`),
    }))
  )

  return (
    <FilterBar
      layout={children}
      compact
      filters={[
        {
          key: "actor",
          label: t(`${F}.actor`),
          kind: "single",
          options: actors,
          // Someone taken off the team since: still chosen, named by id
          format: (id) => id,
        },
        { key: "resource", label: t(`${F}.resource`), kind: "single", options: resourceOptions },
        { key: "days", label: t(`${F}.days`), kind: "days", hint: t(`${F}.rangeHint`) },
      ]}
      values={{
        actor: search.actor,
        resource: search.resource,
        days: { from: search.from, to: search.to },
      }}
      onChange={(key, value) => {
        if (key === "days") {
          const days = value as DayRange | undefined
          onChange({ from: days?.from, to: days?.to })
          return
        }
        onChange({ [key]: value as string | undefined })
      }}
      onClear={() => {
        onChange({ actor: undefined, resource: undefined, from: undefined, to: undefined })
      }}
    />
  )
}
