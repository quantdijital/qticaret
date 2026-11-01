import { Cookie } from "lucide-react"
import type { CookieBannerView, Translate } from "@qticaret/ui"

/**
 * The cookie question (F13.8, D9): what the shop uses beyond the
 * necessary, "accept all" and "only necessary" side by side and equally
 * plain (no nudging), the categories behind "choose". One plain form;
 * it answers before any script runs.
 */
export function CookieBanner({
  banner,
  save,
  t,
}: {
  banner: CookieBannerView
  save: (form: FormData) => Promise<void>
  t: Translate
}) {
  const button = "h-10 rounded-full px-5 text-sm font-semibold transition-colors whitespace-nowrap"
  return (
    <section
      aria-labelledby="cerez-baslik"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-3xl border bg-card p-5 shadow-2xl shadow-foreground/10 sm:inset-x-6 sm:bottom-6 sm:p-6"
    >
      <form action={save} className="flex flex-col gap-4">
        <input type="hidden" name="policy_version" value={banner.policyVersion ?? ""} />
        <div className="flex gap-3.5">
          <span className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-muted sm:flex">
            <Cookie className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1.5">
            <h2 id="cerez-baslik" className="font-sans text-base font-semibold tracking-normal">
              {t("cookies.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("cookies.text")}{" "}
              {banner.policyPath && (
                <a
                  href={banner.policyPath}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {t("cookies.policy")}
                </a>
              )}
            </p>
          </div>
        </div>
        <details className="group rounded-2xl border bg-background">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:hidden">
            {t("cookies.choose")}
          </summary>
          <div className="flex flex-col gap-3 border-t px-4 py-4 text-sm">
            <label className="flex items-start gap-3 opacity-70">
              <input
                type="checkbox"
                checked
                disabled
                className="mt-0.5 size-4.5 accent-foreground"
              />
              <span>
                <span className="block font-medium">{t("cookies.necessary")}</span>
                <span className="text-muted-foreground">{t("cookies.necessary_text")}</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="analytics"
                className="mt-0.5 size-4.5 accent-foreground"
              />
              <span>
                <span className="block font-medium">{t("cookies.analytics")}</span>
                <span className="text-muted-foreground">{t("cookies.analytics_text")}</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="marketing"
                className="mt-0.5 size-4.5 accent-foreground"
              />
              <span>
                <span className="block font-medium">{t("cookies.marketing")}</span>
                <span className="text-muted-foreground">{t("cookies.marketing_text")}</span>
              </span>
            </label>
            <button
              type="submit"
              name="choice"
              value="custom"
              className={`${button} self-start border border-foreground hover:bg-foreground hover:text-background`}
            >
              {t("cookies.save_choice")}
            </button>
          </div>
        </details>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            type="submit"
            name="choice"
            value="necessary"
            className={`${button} flex-1 border border-foreground hover:bg-foreground hover:text-background sm:flex-none`}
          >
            {t("cookies.only_necessary")}
          </button>
          <button
            type="submit"
            name="choice"
            value="all"
            className={`${button} flex-1 border border-foreground bg-foreground text-background hover:opacity-90 sm:flex-none`}
          >
            {t("cookies.accept_all")}
          </button>
        </div>
      </form>
    </section>
  )
}
