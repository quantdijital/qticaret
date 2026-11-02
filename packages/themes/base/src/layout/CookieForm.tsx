import { Cookie } from "lucide-react"
import type { CookieBannerView, Translate } from "@qticaret/ui"

const BUTTON = "h-10 rounded-button px-5 text-sm font-semibold transition-colors whitespace-nowrap"

function Choice({
  name,
  label,
  text,
  checked,
}: {
  name: string
  label: string
  text: string
  checked: boolean
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="mt-0.5 size-4.5 accent-foreground"
      />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="text-muted-foreground">{text}</span>
      </span>
    </label>
  )
}

/**
 * The cookie question's form (F13.8, D9): what the shop uses beyond the
 * necessary, "accept all" and "only necessary" side by side and equally
 * plain (no nudging), the categories behind "choose", ticked as the answer
 * in force. One plain form; it answers before any script runs. In the
 * banner first asked, on the preferences link and page the choices open.
 */
export function CookieForm({
  banner,
  save,
  t,
  headingId,
  onPage = false,
}: {
  banner: CookieBannerView
  save: (form: FormData) => Promise<void>
  t: Translate
  headingId: string
  /** On `/cerez-tercihleri`: back there once saved. */
  onPage?: boolean
}) {
  return (
    <form
      // A new answer from the server draws the boxes afresh
      key={`${String(banner.due)}:${String(banner.analytics)}:${String(banner.marketing)}`}
      action={save}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="policy_version" value={banner.policyVersion ?? ""} />
      {onPage && <input type="hidden" name="return" value="preferences" />}
      <div className="flex gap-3.5">
        <span className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-muted sm:flex">
          <Cookie className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 id={headingId} className="font-sans text-base font-semibold tracking-normal">
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
      <details className="group rounded-2xl border bg-background" open={onPage || !banner.due}>
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:hidden">
          {t("cookies.choose")}
        </summary>
        <div className="flex flex-col gap-3 border-t px-4 py-4 text-sm">
          <label className="flex items-start gap-3 opacity-70">
            <input type="checkbox" checked disabled className="mt-0.5 size-4.5 accent-foreground" />
            <span>
              <span className="block font-medium">{t("cookies.necessary")}</span>
              <span className="text-muted-foreground">{t("cookies.necessary_text")}</span>
            </span>
          </label>
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
            className={`${BUTTON} self-start border border-foreground hover:bg-foreground hover:text-background`}
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
          className={`${BUTTON} flex-1 border border-foreground hover:bg-foreground hover:text-background sm:flex-none`}
        >
          {t("cookies.only_necessary")}
        </button>
        <button
          type="submit"
          name="choice"
          value="all"
          className={`${BUTTON} flex-1 border border-foreground bg-foreground text-background hover:opacity-90 sm:flex-none`}
        >
          {t("cookies.accept_all")}
        </button>
      </div>
    </form>
  )
}
