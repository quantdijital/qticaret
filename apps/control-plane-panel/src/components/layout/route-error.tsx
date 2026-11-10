import { useTranslation } from "react-i18next"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { PlatformBar } from "./platform-bar"

/** A page that could not open (the control plane out of reach): the bar, one line, a retry. */
export function RouteError() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-svh flex-col">
      <PlatformBar />
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
