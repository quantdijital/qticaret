import { useQuery } from "@tanstack/react-query"
import { SlidersHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { sectionQuery } from "@/features/settings/api/sections"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"
import { Panel, PanelGroup } from "../panel-header"
import { ContactFormFields } from "./contact-form-fields"
import { InfoPagesFields } from "./info-pages-fields"

const S = "storefront.editor.shared.preferences"

/**
 * How the storefront behaves, beside the theme's settings (the owner,
 * 2026-11-16: no sidebar item of its own): the contact form's page and the
 * payment and shipping pages. Not part of the draft: each group saves to
 * the storefront section at once, as it did on its own page, and the panel
 * says so. Maintenance mode is Settings' (it closes the storefront at once).
 */
export function PreferencesPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const query = useQuery(sectionQuery<StorefrontSettings>("storefront"))
  return (
    <Panel icon={SlidersHorizontal} title={t(`${S}.title`)} onBack={onBack}>
      <p className="border-b px-5 py-4 text-[13px] leading-5 text-muted-foreground">
        {t(`${S}.description`)}
      </p>
      {query.isError ? (
        <div className="p-5">
          <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
        </div>
      ) : query.data ? (
        <>
          <PanelGroup
            title={t("settings.storefront.contactForm.title")}
            hint={t("settings.storefront.contactForm.description")}
          >
            <ContactFormFields saved={query.data.values} />
          </PanelGroup>
          <PanelGroup
            title={t("settings.storefront.infoPages.title")}
            hint={t("settings.storefront.infoPages.description")}
          >
            <InfoPagesFields saved={query.data.values} />
          </PanelGroup>
        </>
      ) : (
        <div className="p-5">
          <LoadingRows rows={4} />
        </div>
      )}
    </Panel>
  )
}
