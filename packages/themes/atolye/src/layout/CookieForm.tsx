import type { CookieBannerView, Translate } from "@qticaret/ui"

function Choice({
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
    <label className="at-check flex min-h-11 cursor-pointer items-start gap-3 py-2 has-disabled:cursor-not-allowed">
      <input
        type="checkbox"
        name={name}
        defaultChecked={disabled || checked}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        className="mt-0.5 size-5 shrink-0 accent-(--color-text)"
      />
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        <span className="text-text-2">{text}</span>
      </span>
    </label>
  )
}

/**
 * The cookie question's form (F13.8, D9): what the shop uses beyond the
 * necessary, "Yalnızca zorunlu" and "Tümünü kabul et" side by side in the
 * same quiet style (no nudging), the categories behind "Tercihleri seç",
 * ticked as the answer in force. One plain form; it answers before any
 * script runs. The field names and values are the storefront's.
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
      className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-x-(--gap-columns)"
    >
      <input type="hidden" name="policy_version" value={banner.policyVersion ?? ""} />
      {onPage && <input type="hidden" name="return" value="preferences" />}
      <div className="flex flex-col gap-1 pr-10 lg:pr-0">
        <h2 id={headingId} className="max-w-none font-body text-md font-medium tracking-normal">
          {t("cookies.title")}
        </h2>
        <p className="max-w-[75ch] text-xs text-text-2">
          {t("cookies.text")}{" "}
          {banner.policyPath && (
            <a href={banner.policyPath} className="at-inline-link text-text">
              {t("cookies.policy")}
            </a>
          )}
        </p>
      </div>
      <details className="group text-sm lg:col-start-1 lg:row-start-2" open={onPage || !banner.due}>
        <summary className="at-link cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          {t("cookies.choose")}
        </summary>
        <div className="flex flex-col gap-1 border-t border-rule pt-2">
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
            className="at-btn at-btn--quiet mt-2 min-h-11 self-start px-4"
          >
            {t("cookies.save_choice")}
          </button>
        </div>
      </details>
      <div className="grid grid-cols-2 gap-2 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:self-start">
        <button
          type="submit"
          name="choice"
          value="necessary"
          className="at-btn at-btn--quiet min-h-11 px-4"
        >
          {t("cookies.only_necessary")}
        </button>
        <button
          type="submit"
          name="choice"
          value="all"
          className="at-btn at-btn--quiet min-h-11 px-4"
        >
          {t("cookies.accept_all")}
        </button>
      </div>
    </form>
  )
}
