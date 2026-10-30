import { useQuery } from "@tanstack/react-query"
import { CalendarRange, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AUDIT_ACTOR_TYPES, auditResourceTypesQuery } from "@/features/settings/api/audit"
import type { AuditSearch } from "@/features/settings/api/audit"
import { teamQuery } from "@/features/settings/api/team"
import { groupResources } from "@/features/settings/audit-resources"
import { turkishDay } from "@/features/reports/range"
import { formatDate } from "@/lib/format"

const F = "settings.audit.filters"
const ALL = "__all"

interface AuditFiltersProps {
  search: AuditSearch
  onChange: (next: Partial<AuditSearch>) => void
}

/** The days an entry falls in, as Turkish days; either end may stay open. */
function RangeFilter({ search, onChange }: AuditFiltersProps) {
  const { t } = useTranslation()
  const today = turkishDay(new Date())
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(search.from ?? "")
  const [to, setTo] = useState(search.to ?? "")
  const chosen = search.from ?? search.to
  const valid = (from === "" || to === "" || from <= to) && (from !== "" || to !== "")
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setFrom(search.from ?? "")
          setTo(search.to ?? "")
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant={chosen ? "secondary" : "outline"}
          className="w-full justify-start font-normal sm:w-56"
        >
          <CalendarRange aria-hidden="true" />
          {chosen
            ? t(`${F}.range`, {
                from: search.from ? formatDate(search.from) : "…",
                to: search.to ? formatDate(search.to) : "…",
              })
            : t(`${F}.anyTime`)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (valid) {
              setOpen(false)
              onChange({ from: from || undefined, to: to || undefined })
            }
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("period.custom.from")}
            <Input
              type="date"
              value={from}
              max={to || today}
              onChange={(event) => {
                setFrom(event.target.value)
              }}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("period.custom.to")}
            <Input
              type="date"
              value={to}
              min={from || undefined}
              max={today}
              onChange={(event) => {
                setTo(event.target.value)
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">{t(`${F}.rangeHint`)}</p>
          <Button type="submit" disabled={!valid}>
            {t("period.custom.apply")}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
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
      <RangeFilter search={search} onChange={onChange} />
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
