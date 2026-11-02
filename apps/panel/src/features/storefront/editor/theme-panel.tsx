import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { sectionQuery } from "@/features/settings/api/sections"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { isHexColor, useSaveStorefront } from "@/features/settings/storefront"
import { errorText } from "@/lib/errors"
import { STOREFRONT_THEME_COLOR, storefrontTextOn } from "@/theme/storefront"
import { FieldGroup } from "./forms/fields"

const C = "storefront.editor.theme"

/** The announcement bar and a primary button as the storefront paints them in `color`. */
function ColorPreview({ color, announcement }: { color: string; announcement: string }) {
  const { t } = useTranslation()
  const paint = { backgroundColor: color, color: storefrontTextOn(color) }
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-xs font-medium text-muted-foreground">
        {t(`${C}.sample`)}
      </figcaption>
      <div className="flex flex-col overflow-hidden rounded-md border">
        <p style={paint} className="truncate px-4 py-2 text-center text-xs">
          {announcement}
        </p>
        <div className="p-3">
          <span
            style={paint}
            className="inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
          >
            {t(`${C}.button`)}
          </span>
        </div>
      </div>
    </figure>
  )
}

/** The main colour: its own field, saved at once and live at once (not part of the draft). */
function ColorField({
  saved,
  announcement,
  onSaved,
}: {
  saved: string | null
  announcement: string
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const { save, saving } = useSaveStorefront()
  // None until something is typed: the stored colour shows meanwhile
  const [typed, setTyped] = useState<string | null>(null)
  const value = typed ?? saved ?? ""
  const whole = value === "" || isHexColor(value)
  const shown = isHexColor(value)
    ? value
    : value === ""
      ? STOREFRONT_THEME_COLOR
      : (saved ?? STOREFRONT_THEME_COLOR)
  const store = (color: string | null) => {
    save({ primary_color: color }, () => {
      setTyped(null)
      onSaved()
    })
  }
  const changed = typed !== null && value !== (saved ?? "")
  return (
    <FieldGroup title={t(`${C}.color`)} hint={t(`${C}.colorHint`)}>
      <Field
        label={t(`${C}.code`)}
        htmlFor="theme-color"
        error={whole ? undefined : t("settings.storefront.errors.colorInvalid")}
      >
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={t(`${C}.picker`)}
            value={shown}
            onChange={(event) => {
              setTyped(event.target.value)
            }}
            className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
          />
          <Input
            id="theme-color"
            value={value}
            placeholder={STOREFRONT_THEME_COLOR}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!whole}
            className="w-32 font-mono"
            onChange={(event) => {
              setTyped(event.target.value.trim().toLowerCase())
            }}
          />
        </div>
      </Field>
      <ColorPreview color={shown} announcement={announcement} />
      <p className="text-xs text-muted-foreground">{t(`${C}.live`)}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!changed || !whole || saving}
          onClick={() => {
            store(value === "" ? null : value)
          }}
        >
          {saving ? <Loader2 className="animate-spin" /> : null}
          {t(`${C}.save`)}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={saved === null || saving}
          onClick={() => {
            store(null)
          }}
        >
          <RotateCcw />
          {t(`${C}.reset`)}
        </Button>
      </div>
    </FieldGroup>
  )
}

interface ThemePanelProps {
  /** The first announcement line, for the colour's sample. */
  announcement: string | null
  onBack: () => void
  /** A theme setting reached the storefront: the preview reloads. */
  onSaved: () => void
}

/**
 * The theme's own settings (adr/0049 §6.4): the main colour today. They
 * are the shop's settings, saved at once, not part of the draft.
 */
export function ThemePanel({ announcement, onBack, onSaved }: ThemePanelProps) {
  const { t } = useTranslation()
  const query = useQuery(sectionQuery<StorefrontSettings>("storefront"))
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
      <div className="flex flex-col gap-6 p-4">
        {query.isError ? (
          <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
        ) : query.data ? (
          <ColorField
            saved={query.data.values.primary_color}
            announcement={announcement ?? t(`${C}.sampleLine`)}
            onSaved={onSaved}
          />
        ) : (
          <LoadingRows rows={3} />
        )}
      </div>
    </div>
  )
}
