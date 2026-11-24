import { Link, getRouteApi } from "@tanstack/react-router"
import { BadgePercent, Info, Mail } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { POPUP_TYPES } from "@/features/popups/api/types"
import type { PopupType } from "@/features/popups/api/types"
import { useCanWritePopups } from "@/features/popups/api/access"
import { PopupsGate } from "@/features/popups/components/popups-gate"
import { PopupForm } from "@/features/popups/editor/popup-form"

const P = "popups"
const route = getRouteApi("/_auth/popups/new")

const ICONS = { info: Info, campaign: BadgePercent, newsletter: Mail } as const

/** The first step: which kind of pop-up, as three cards of one height. */
export function TypeChooser() {
  const { t } = useTranslation()
  return (
    <ul className="grid items-stretch gap-[var(--grid-gap)] md:grid-cols-3">
      {POPUP_TYPES.map((type) => {
        const Icon = ICONS[type]
        return (
          <li key={type} className="flex">
            <Link
              to="/popups/new"
              search={{ type }}
              className="flex w-full flex-col gap-3 rounded-lg border bg-card p-5 shadow-card transition-colors outline-none hover:border-primary hover:bg-accent focus-visible:border-primary"
            >
              <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
              <span className="text-[15px] font-semibold">{t(`${P}.types.${type}`)}</span>
              <span className="text-[13px] leading-5 text-muted-foreground">
                {t(`${P}.typeHints.${type}`)}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function NewPopup({ type }: { type: PopupType | undefined }) {
  const { t } = useTranslation()
  const canWrite = useCanWritePopups()
  if (!canWrite) {
    return (
      <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
        {t(`${P}.noAccess`)}
      </p>
    )
  }
  // The type picks the defaults; a new choice starts a new form
  return type ? <PopupForm key={type} existing={null} type={type} canWrite /> : <TypeChooser />
}

/** A new pop-up (adr/0080 S2): its type first, then the one page form. */
export function NewPopupPage() {
  const { t } = useTranslation()
  const { type } = route.useSearch()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={type ? t(`${P}.newOf`, { type: t(`${P}.types.${type}`) }) : t(`${P}.new`)}
        back={{ to: "/popups", label: t(`${P}.title`) }}
      />
      <PopupsGate>
        <NewPopup type={type} />
      </PopupsGate>
    </div>
  )
}
