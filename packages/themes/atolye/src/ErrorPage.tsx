"use client"

import { RotateCw } from "lucide-react"
import type { Translate } from "@qticaret/ui"
import { Container } from "./parts/Container"

/**
 * A page the server could not make (adr/0046 Ek 2026-11-05): one graphite
 * panel, the 404's stage without its data: the title, one line, "Tekrar
 * dene" (the stage's light button) and the way home. No categories and
 * no search: it must stand with the backend away, when the shop's frame
 * cannot be drawn either (the storefront's `global-error` puts it alone
 * on the bench). The theme's `/error` entry: a client component.
 */
export function ErrorPage({ t, retry }: { t: Translate; retry: () => void }) {
  return (
    <Container className="py-(--section-gap-s)">
      <section
        aria-labelledby="hata"
        className="gf-stage mx-auto flex max-w-3xl flex-col gap-5 rounded-tile p-6 sm:p-10 lg:p-16"
      >
        <h1 id="hata">{t("error.title")}</h1>
        <p className="max-w-[44ch] text-stage-text-2 lg:text-lead">{t("error.body")}</p>
        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:gap-6">
          <button
            type="button"
            className="gf-btn"
            onClick={() => {
              retry()
            }}
          >
            <RotateCw className="size-5" aria-hidden="true" strokeWidth={2} />
            {t("error.retry")}
          </button>
          <a href="/" className="gf-link self-start sm:self-auto">
            {t("error.home")}
          </a>
        </div>
      </section>
    </Container>
  )
}
