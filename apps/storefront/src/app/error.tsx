"use client"

import { t } from "@/lib/i18n"

/**
 * A page the server could not make (the backend busy or away): a plain
 * apology and a way to try again, inside the shop's frame when it stands.
 */
export default function PageError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="text-3xl">{t("error.title")}</h1>
      <p className="text-muted-foreground">{t("error.body")}</p>
      <button
        type="button"
        onClick={() => {
          reset()
        }}
        className="h-11 rounded-full bg-foreground px-6 text-sm font-semibold text-background"
      >
        {t("error.retry")}
      </button>
    </div>
  )
}
