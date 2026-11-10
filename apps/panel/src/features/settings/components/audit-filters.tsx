import { useQuery } from "@tanstack/react-query"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { DayRangeFilter } from "@qticaret/admin-ui/patterns/day-range-filter"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { AUDIT_ACTOR_TYPES, auditResourceTypesQuery } from "@/features/settings/api/audit"
import type { AuditSearch } from "@/features/settings/api/audit"
import { teamQuery } from "@/features/settings/api/team"
import { groupResources } from "@/features/settings/audit-resources"

const F = "settings.audit.filters"
const ALL = "__all"

interface AuditFiltersProps {
  search: AuditSearch
  onChange: (next: Partial<AuditSearch>) => void
}

/**
 * Who, what and when (F12.5), above the log's table: one row of equal
 * controls, wrapping on a phone. Every choice goes into the address.
 */
export function AuditFilters({ search, onChange }: AuditFiltersProps) {
  const { t } = useTranslation()
  const team = useQuery(teamQuery())
  const types = useQuery(auditResourceTypesQuery())
  const members = team.data?.staff ?? []
  const resources = types.data?.resource_types ?? []
  const actor = search.actor ?? ALL
  // Someone taken off the team since: still chosen, named by id
  const formerMember =
    actor !== ALL &&
    !(AUDIT_ACTOR_TYPES as readonly string[]).includes(actor) &&
    team.isSuccess &&
    !members.some((member) => member.id === actor)
  const filtered = Boolean(search.actor ?? search.resource ?? search.from ?? search.to)

  return (
    <div className="grid grid-cols-1 gap-2 border-b p-3 sm:flex sm:flex-wrap sm:items-center">
      <Select
        value={actor}
        onValueChange={(next) => {
          onChange({ actor: next === ALL ? undefined : next })
        }}
      >
        <SelectTrigger className="w-full sm:w-56" aria-label={t(`${F}.actor`)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t(`${F}.anyone`)}</SelectItem>
          {members.length > 0 || formerMember ? (
            <SelectGroup>
              <SelectLabel>{t(`${F}.people`)}</SelectLabel>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {[member.first_name, member.last_name].filter(Boolean).join(" ") || member.email}
                </SelectItem>
              ))}
              {formerMember ? <SelectItem value={actor}>{actor}</SelectItem> : null}
            </SelectGroup>
          ) : null}
          <SelectGroup>
            <SelectLabel>{t(`${F}.others`)}</SelectLabel>
            {AUDIT_ACTOR_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`settings.audit.actors.${type}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select
        value={search.resource ?? ALL}
        onValueChange={(next) => {
          onChange({ resource: next === ALL ? undefined : next })
        }}
      >
        <SelectTrigger className="w-full sm:w-56" aria-label={t(`${F}.resource`)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t(`${F}.anything`)}</SelectItem>
          {groupResources(
            [
              ...resources,
              // Chosen from a shared link before the list arrived, or no longer listed
              ...(search.resource && !resources.includes(search.resource) ? [search.resource] : []),
            ],
            (type) => t(`settings.audit.resources.${type}`, { defaultValue: type })
          ).map(({ group, options }) => (
            <SelectGroup key={group}>
              <SelectLabel>{t(`${F}.groups.${group}`)}</SelectLabel>
              {options.map(({ type, label }) => (
                <SelectItem key={type} value={type}>
                  {label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <DayRangeFilter
        value={{ from: search.from, to: search.to }}
        hint={t(`${F}.rangeHint`)}
        onChange={onChange}
      />
      {filtered ? (
        <Button
          variant="ghost"
          className="w-full sm:ml-auto sm:w-auto"
          onClick={() => {
            onChange({ actor: undefined, resource: undefined, from: undefined, to: undefined })
          }}
        >
          <X aria-hidden="true" />
          {t(`${F}.clear`)}
        </Button>
      ) : null}
    </div>
  )
}
