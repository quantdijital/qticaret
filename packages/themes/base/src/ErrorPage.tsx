"use client"

import type { Translate } from "@qticaret/ui"

/**
 * A page the server could not make (the backend busy or away; adr/0046 Ek
 * 2026-11-05): a plain apology, a way to try again and the way home. The
 * theme's `/error` entry, a client component; it takes no data.
 */
export function ErrorPage({ t, retry }: { t: Translate; retry: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="text-3xl">{t("error.title")}</h1>
      <p className="text-muted-foreground">{t("error.body")}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            retry()
          }}
          className="h-11 rounded-full bg-foreground px-6 text-sm font-semibold text-background"
        >
          {t("error.retry")}
        </button>
        <a href="/" className="px-2 text-sm font-semibold underline underline-offset-4">
          {t("error.home")}
        </a>
      </div>
    </div>
  )
}
