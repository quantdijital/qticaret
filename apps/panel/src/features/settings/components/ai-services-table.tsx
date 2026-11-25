import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@qticaret/admin-ui/ui/table"
import type { AiServiceView } from "@/features/ai/api/ai"
import { useCan } from "@/features/auth/api/staff"
import { AiServiceRow } from "@/features/settings/components/ai-service-row"

const C = "ai.card"

/**
 * The AI services the shop can connect with its own key, a row each
 * (adr/0071 §13): compact, the longer words behind (i). On a phone the
 * badges' column folds into the name's second line below `xl`, and each
 * row is a small card below `sm`, so nothing scrolls
 * sideways.
 */
export function AiServicesTable({
  services,
  ownKeys,
  keyConfigured,
}: {
  services: AiServiceView[]
  ownKeys: boolean
  keyConfigured: boolean
}) {
  const { t } = useTranslation()
  const mayChange = useCan("accounts")
  return (
    <SectionCard
      title={t(`${C}.servicesTitle`)}
      {...(mayChange ? {} : { description: t(`${C}.ownerConnects`) })}
      flush
    >
      <Table aria-label={t(`${C}.servicesTitle`)} className="max-sm:block">
        {/* A phone: each row is a small card, the column names would name nothing */}
        <TableHeader className="max-sm:hidden">
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5">{t(`${C}.columns.service`)}</TableHead>
            <TableHead className="hidden xl:table-cell">{t(`${C}.columns.capabilities`)}</TableHead>
            <TableHead className="w-12 text-center">{t(`${C}.columns.data`)}</TableHead>
            <TableHead>{t(`${C}.columns.status`)}</TableHead>
            <TableHead className="pr-5">
              <span className="sr-only">{t(`${C}.columns.actions`)}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="max-sm:block">
          {/* The platform's credits have no key: their own card says them (AiCreditsCard) */}
          {services
            .filter((service) => service.funding === "own_key")
            .map((service) => (
              <AiServiceRow
                key={service.id}
                service={service}
                ownKeys={ownKeys}
                keyConfigured={keyConfigured}
              />
            ))}
        </TableBody>
      </Table>
    </SectionCard>
  )
}
