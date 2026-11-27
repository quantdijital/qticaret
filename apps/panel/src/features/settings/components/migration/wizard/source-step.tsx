import { useTranslation } from "react-i18next"
import type { MigrationSourceKind } from "@/features/settings/api/migration"
import { cn } from "@qticaret/admin-ui/lib/utils"

const W = "settings.migration.wizard.sources"
// The team's bundle shows only from its own link (`?kaynak=paket`)
const SOURCES: readonly MigrationSourceKind[] = ["wordpress", "shopify", "feed", "customers"]

interface SourceStepProps {
  value: MigrationSourceKind
  withBundle: boolean
  onChange: (source: MigrationSourceKind) => void
}

/** Step 1: which the old site is, one card each, equal in height. */
export function SourceStep({ value, withBundle, onChange }: SourceStepProps) {
  const { t } = useTranslation()
  const sources = withBundle ? [...SOURCES, "bundle" as const] : SOURCES
  return (
    <div
      role="radiogroup"
      aria-label={t("settings.migration.wizard.steps.source.description")}
      className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {sources.map((source) => {
        const checked = value === source
        return (
          <button
            key={source}
            type="button"
            role="radio"
            aria-checked={checked}
            data-testid={`migration-source-${source}`}
            className={cn(
              "flex h-full flex-col gap-1 rounded-lg border bg-card px-4 py-3.5 text-left shadow-card transition-colors",
              "outline-none focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ring",
              checked ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            )}
            onClick={() => {
              onChange(source)
            }}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-full border",
                  checked && "border-primary"
                )}
              >
                {checked ? <span className="size-2 rounded-full bg-primary" /> : null}
              </span>
              {t(`${W}.${source}.title`)}
            </span>
            <span className="text-[13px] text-muted-foreground">{t(`${W}.${source}.text`)}</span>
          </button>
        )
      })}
    </div>
  )
}
