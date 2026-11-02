import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { sectionQuery } from "@/features/settings/api/sections"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { themeQuery } from "@/features/storefront/api/theme"
import { errorText } from "@/lib/errors"
import { ThemeForm } from "./theme-form"

const C = "storefront.editor.theme"

interface ThemePanelProps {
  /** The first announcement line, for the sample. */
  announcement: string | null
  onBack: () => void
  /** A theme setting reached the storefront: the preview reloads. */
  onSaved: () => void
}

/**
 * The theme's own settings (adr/0049 §6.4, adr/0053 §B): the shop's
 * settings, saved at once, not part of the draft. The storefront section
 * is read for its old main colour, shown here until one is saved.
 */
export function ThemePanel({ announcement, onBack, onSaved }: ThemePanelProps) {
  const { t } = useTranslation()
  const theme = useQuery(themeQuery())
  const storefront = useQuery(sectionQuery<StorefrontSettings>("storefront"))
  const failed = theme.isError ? theme : storefront.isError ? storefront : null
  let body
  if (failed) {
    body = (
      <div className="p-4">
        <ErrorState text={errorText(t, failed.error)} onRetry={() => void failed.refetch()} />
      </div>
    )
  } else if (theme.data && storefront.data) {
    body = (
      <ThemeForm
        saved={theme.data.values}
        legacyPrimary={storefront.data.values.primary_color}
        announcement={announcement ?? t(`${C}.sampleLine`)}
        onSaved={onSaved}
      />
    )
  } else {
    body = (
      <div className="p-4">
        <LoadingRows rows={6} />
      </div>
    )
  }
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-card px-2 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("storefront.editor.panel.back")}
          onClick={onBack}
        >
          <ArrowLeft />
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{t(`${C}.title`)}</h2>
      </div>
      {body}
    </div>
  )
}
