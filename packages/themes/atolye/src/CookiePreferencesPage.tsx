import { CircleCheck } from "lucide-react"
import type { CookiePreferencesPageView, Translate } from "@qticaret/ui"
import { Choice } from "./frame/Consent"
import { Container } from "./parts/Container"

/**
 * `/cerez-tercihleri` (D9): the cookie card's question on a page of its
 * own, where the footer's link leads without script. One tinted well:
 * what the shop uses beyond the necessary, the categories open and ticked
 * as the answer in force, then "Seçimimi kaydet", "Yalnızca zorunlu" and
 * "Tümünü kabul et" side by side in the same quiet style (no nudging).
 * One plain form; once saved the storefront comes back here with a notice.
 */
export function CookiePreferencesPage({
  view,
  t,
  save,
}: {
  view: CookiePreferencesPageView
  t: Translate
  save: (form: FormData) => Promise<void>
}) {
  const { banner } = view
  return (
    <Container className="pt-8 lg:pt-12">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <h1>{view.title}</h1>
        {view.notice && (
          <p
            role="status"
            className="flex items-start gap-3 rounded-media gf-pane p-4 text-md font-semibold"
          >
            <CircleCheck
              className="mt-0.5 size-5 shrink-0 text-ok"
              aria-hidden="true"
              strokeWidth={1.75}
            />
            {view.notice}
          </p>
        )}
        <form
          // A new answer from the server draws the boxes afresh
          key={`${String(banner.due)}:${String(banner.analytics)}:${String(banner.marketing)}`}
          action={save}
          aria-labelledby="cerez-tercihleri-baslik"
          className="flex flex-col gap-5 rounded-tile gf-pane p-5 sm:p-8"
        >
          <input type="hidden" name="policy_version" value={banner.policyVersion ?? ""} />
          <input type="hidden" name="return" value="preferences" />
          <div className="flex flex-col gap-2">
            <h2 id="cerez-tercihleri-baslik">{t("cookies.title")}</h2>
            <p className="text-md text-text-2">
              {t("cookies.text")}{" "}
              {banner.policyPath && (
                <a href={banner.policyPath} className="font-semibold text-text underline">
                  {t("cookies.policy")}
                </a>
              )}
            </p>
          </div>
          <div className="flex flex-col gap-1 rounded-media gf-pane-inner p-2">
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
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" name="choice" value="custom" className="gf-btn gf-btn--quiet">
              {t("cookies.save_choice")}
            </button>
            <button type="submit" name="choice" value="necessary" className="gf-btn gf-btn--quiet">
              {t("cookies.only_necessary")}
            </button>
            <button type="submit" name="choice" value="all" className="gf-btn gf-btn--quiet">
              {t("cookies.accept_all")}
            </button>
          </div>
        </form>
      </div>
    </Container>
  )
}
