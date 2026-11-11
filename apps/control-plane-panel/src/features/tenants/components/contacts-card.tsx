import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useRecordWalk } from "@qticaret/admin-ui/hooks/use-record-walk"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { EmptyRow } from "@qticaret/admin-ui/patterns/empty-row"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { formatPhone } from "@qticaret/admin-ui/lib/format"
import { useMe } from "@/features/auth/api"
import type { Contact, TenantDetail } from "@/features/tenants/api"
import { canManageShops } from "@/features/tenants/permissions"
import { ContactDialog } from "./contact-dialog"

/**
 * The people at the shop (adr/0061 §2): name and role, e-mail, phone, the
 * primary billing contact marked (the payment reminders go to them). A
 * row opens the contact in one dialog, ‹ n / m › to the next; owner and
 * operator change and remove them, the others read.
 */
export function ContactsCard({ shop }: { shop: TenantDetail }) {
  const { t } = useTranslation()
  const me = useMe()
  const writable = canManageShops(me?.role)
  const walk = useRecordWalk(shop.contacts, (contact) => contact.id)
  const [adding, setAdding] = useState(false)
  const add = writable ? (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        setAdding(true)
      }}
    >
      {t("contacts.add")}
    </Button>
  ) : undefined
  const columns: Column<Contact>[] = [
    {
      key: "name",
      header: t("contacts.columns.name"),
      cell: (contact) => (
        <div className="flex min-w-0 flex-col">
          <button
            type="button"
            className="truncate text-left font-medium hover:underline"
            onClick={(event) => {
              event.stopPropagation()
              walk.show(contact)
            }}
          >
            {contact.name}
          </button>
          <span className="text-xs text-muted-foreground">
            {t(`contacts.roles.${contact.role}`)}
          </span>
        </div>
      ),
    },
    {
      key: "email",
      header: t("contacts.columns.email"),
      cell: (contact) => <span className="break-all">{contact.email}</span>,
    },
    {
      key: "phone",
      header: t("contacts.columns.phone"),
      className: "hidden md:table-cell",
      cell: (contact) => (contact.phone ? formatPhone(contact.phone) : "—"),
    },
    {
      key: "billing",
      header: <span className="sr-only">{t("contacts.primary")}</span>,
      align: "right",
      cell: (contact) =>
        contact.is_primary_billing ? (
          <StatusBadge tone="info">{t("contacts.primary")}</StatusBadge>
        ) : null,
    },
  ]
  const dialog = (
    <ContactDialog
      tenantId={shop.tenant.id}
      contact={adding ? null : walk.open}
      open={adding || walk.open !== null}
      steps={adding ? null : walk.steps}
      readOnly={!writable}
      onClose={() => {
        setAdding(false)
        walk.close()
      }}
    />
  )
  if (shop.contacts.length === 0) {
    return (
      <>
        <EmptyRow text={t("contacts.empty")} action={add} />
        {dialog}
      </>
    )
  }
  return (
    <SectionCard title={t("contacts.title")} description={t("contacts.text")} action={add} flush>
      <DataTable
        columns={columns}
        rows={shop.contacts}
        rowKey={(contact) => contact.id}
        onRowClick={walk.show}
        empty={t("contacts.empty")}
      />
      {dialog}
    </SectionCard>
  )
}
