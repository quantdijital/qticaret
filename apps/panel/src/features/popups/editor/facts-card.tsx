import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import type { PopupDetail } from "@/features/popups/api/types"
import { datesText } from "@/features/popups/components/popup-columns"
import { PopupStateBadge } from "@/features/popups/components/popup-badges"

const P = "popups"

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{children}</dd>
    </div>
  )
}

/**
 * A saved pop-up at a glance, as saved (the form above may hold changes
 * not yet saved): where it stands, its type, design and place, its dates,
 * when it was made and last changed.
 */
export function FactsCard({ popup }: { popup: PopupDetail }) {
  const { t } = useTranslation()
  return (
    <SectionCard title={t(`${P}.facts.title`)}>
      <dl className="flex flex-col gap-1.5 text-sm">
        <Fact label={t(`${P}.columns.state`)}>
          <PopupStateBadge state={popup.state} />
        </Fact>
        <Fact label={t(`${P}.columns.type`)}>{t(`${P}.types.${popup.type}`)}</Fact>
        <Fact label={t(`${P}.form.design`)}>{t(`${P}.choices.design.${popup.design}`)}</Fact>
        <Fact label={t(`${P}.form.layout`)}>{t(`${P}.choices.layout.${popup.layout}`)}</Fact>
        <Fact label={t(`${P}.columns.dates`)}>
          <span className="tabular-nums">{datesText(t, popup)}</span>
        </Fact>
        <Fact label={t(`${P}.facts.created`)}>
          <span className="tabular-nums">{formatDate(popup.created_at)}</span>
        </Fact>
        <Fact label={t(`${P}.facts.updated`)}>
          <span className="tabular-nums">{formatDate(popup.updated_at)}</span>
        </Fact>
      </dl>
    </SectionCard>
  )
}
