import type { CookieBannerView, Translate } from "@qticaret/ui"
import { KeptForm } from "@qticaret/ui/components/kept-form"
import { ConsentFrame } from "./ConsentFrame"

/** One cookie category with its sentence; the whole row is its label (also `/cerez-tercihleri`). */
export function Choice({
  name,
  label,
  text,
  checked,
  disabled = false,
}: {
  name?: string
  label: string
  text: string
  checked: boolean
  disabled?: boolean
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-inner p-2 hover:bg-paper-2 has-disabled:cursor-not-allowed">
      <input
        type="checkbox"
        name={name}
        defaultChecked={disabled || checked}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        className="mt-0.5 size-5 shrink-0 accent-(--color-text)"
      />
      <span className="flex flex-col text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-text-2">{text}</span>
      </span>
    </label>
  )
}

/**
 * The cookie question (F13.8, D9) as a floating card: what the shop uses
 * beyond the necessary, "Yalnızca zorunlu" and "Tümünü kabul et" side by
 * side in the same quiet style (no nudging), the categories behind
 * "Tercihleri seç", ticked as the answer in force. One plain form; it
 * answers before any script runs. With the script, the card closes in the
 * press's own frame and the answer is sent after it (`KeptForm`, INP).
 * The field names are the storefront's.
 */
export function Consent({
  banner,
  save,
  t,
}: {
  banner: CookieBannerView
  save: (form: FormData) => Promise<void>
  t: Translate
}) {
  return (
    <ConsentFrame open={banner.due} labelledBy="cerez-baslik" closeLabel={t("cookies.close")}>
      <KeptForm
        key={`${String(banner.due)}:${String(banner.analytics)}:${String(banner.marketing)}`}
        action={save}
        className="flex flex-col gap-2.5 sm:gap-3"
      >
        <input type="hidden" name="policy_version" value={banner.policyVersion ?? ""} />
        <div className="flex flex-col gap-1 group-data-reopened/consent:pr-10">
          <h2 id="cerez-baslik" className="max-w-none text-md tracking-normal">
            {t("cookies.title")}
          </h2>
          <p className="text-xs text-text-2">
            {t("cookies.text")}{" "}
            {banner.policyPath && (
              <a href={banner.policyPath} className="font-semibold text-text underline">
                {t("cookies.policy")}
              </a>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-2">
          <button
            type="submit"
            name="choice"
            value="necessary"
            className="gf-btn gf-btn--quiet gf-btn--small flex-1 sm:flex-none"
          >
            {t("cookies.only_necessary")}
          </button>
          <button
            type="submit"
            name="choice"
            value="all"
            className="gf-btn gf-btn--quiet gf-btn--small flex-1 sm:flex-none"
          >
            {t("cookies.accept_all")}
          </button>
          <details className="group w-full text-sm sm:w-auto" open={!banner.due}>
            <summary className="gf-link cursor-pointer px-2">{t("cookies.choose")}</summary>
            <div className="flex flex-col gap-1 pt-2">
              <Choice
                label={t("cookies.necessary")}
                text={t("cookies.necessary_text")}
                checked
                disabled
              />
              <Choice
                name="analytics"
                label={t("cookies.analytics")}
                text={t("cookies.analytics_text")}
                checked={banner.analytics}
              />
              <Choice
                name="marketing"
                label={t("cookies.marketing")}
                text={t("cookies.marketing_text")}
                checked={banner.marketing}
              />
              <button
                type="submit"
                name="choice"
                value="custom"
                className="gf-btn gf-btn--quiet gf-btn--small mt-1 self-start"
              >
                {t("cookies.save_choice")}
              </button>
            </div>
          </details>
        </div>
      </KeptForm>
    </ConsentFrame>
  )
}
