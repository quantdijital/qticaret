import { useTranslation } from "react-i18next"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { useDocumentTitle } from "@qticaret/admin-ui/hooks/use-document-title"

/** A page that could not open (the control plane out of reach): one line, a retry. */
export function RouteError() {
  const { t } = useTranslation()
  useDocumentTitle(t("errors.pageTitle"))
  return (
    <div className="flex min-h-svh flex-col">
      <main className="flex flex-1 items-start justify-center px-6 py-16">
        <div className="flex w-full max-w-md flex-col gap-4">
          <h1 className="text-[22px] leading-tight font-semibold tracking-tight">
            {t("errors.pageTitle")}
          </h1>
          <ErrorState
            text={t("errors.unreachable")}
            onRetry={() => {
              window.location.reload()
            }}
          />
        </div>
      </main>
    </div>
  )
}
