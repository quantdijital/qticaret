import { Plus, Trash2 } from "lucide-react"
import { useFieldArray } from "react-hook-form"
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MAINTENANCE_LIMITS } from "@/features/storefront/maintenance"
import type { MaintenanceParsed, MaintenanceValues } from "@/features/storefront/maintenance"

const P = "storefront.maintenance.page"

interface PathsFieldProps {
  control: Control<MaintenanceValues, unknown, MaintenanceParsed>
  register: UseFormRegister<MaintenanceValues>
  errors: FieldErrors<MaintenanceValues>
}

/**
 * The shop paths left open while it is dark (an about page, the contracts):
 * one per row, `/x/*` for a path and everything below it, 20 at most.
 */
export function MaintenancePathsField({ control, register, errors }: PathsFieldProps) {
  const { t } = useTranslation()
  const { fields, append, remove } = useFieldArray({ control, name: "allow_paths" })
  const full = fields.length >= MAINTENANCE_LIMITS.paths
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="text-sm font-medium">{t(`${P}.paths`)}</legend>
      <p id="maintenance-paths-hint" className="text-xs text-muted-foreground">
        {t(`${P}.pathsHint`)}
      </p>
      {fields.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {fields.map((field, index) => {
            const number = index + 1
            const message = errors.allow_paths?.[index]?.path?.message
            const errorId = `maintenance-path-${String(index)}-error`
            return (
              <li key={field.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={t(`${P}.pathOf`, { number })}
                    aria-invalid={Boolean(message)}
                    aria-describedby={message ? errorId : "maintenance-paths-hint"}
                    placeholder={t(`${P}.pathPlaceholder`)}
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono text-[13px]"
                    {...register(`allow_paths.${index}.path`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t(`${P}.removePath`, { number })}
                    onClick={() => {
                      remove(index)
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
                {message ? (
                  <p id={errorId} role="alert" className="text-xs text-destructive-text">
                    {t(message)}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">{t(`${P}.pathsEmpty`)}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={full}
          onClick={() => {
            append({ path: "" })
          }}
        >
          <Plus />
          {t(`${P}.addPath`)}
        </Button>
        {full ? (
          <span className="text-xs text-muted-foreground">
            {t(`${P}.pathsFull`, { max: MAINTENANCE_LIMITS.paths })}
          </span>
        ) : null}
      </div>
    </fieldset>
  )
}
