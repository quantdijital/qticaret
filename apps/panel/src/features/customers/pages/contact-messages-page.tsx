import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { DataTable } from "@qticaret/admin-ui/patterns/data-table"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { FilterTabs } from "@qticaret/admin-ui/patterns/filter-tabs"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Pagination } from "@qticaret/admin-ui/patterns/pagination"
import { SearchInput } from "@qticaret/admin-ui/patterns/search-input"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { useRecordWalk } from "@qticaret/admin-ui/hooks/use-record-walk"
import {
  CONTACT_PAGE_SIZE,
  CONTACT_SUBJECTS,
  contactMessagesQuery,
} from "@/features/customers/api/contact-messages"
import type {
  ContactMessage,
  ContactStatus,
  ContactSubject,
} from "@/features/customers/api/contact-messages"
import { ContactMessageDialog } from "@/features/customers/components/contact-message-dialog"
import { CustomersNav } from "@/features/customers/components/customers-nav"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"

const route = getRouteApi("/_auth/customers/contact-messages")
const M = "customers.contactMessages"
// The subject filter's "every subject" choice
const EVERY = "all"

function useColumns(onOpen: (message: ContactMessage) => void): Column<ContactMessage>[] {
  const { t } = useTranslation()
  return [
    {
      key: "date",
      header: t(`${M}.columns.date`),
      cell: (message) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDateTime(message.created_at)}
        </span>
      ),
    },
    {
      key: "sender",
      header: t(`${M}.columns.sender`),
      cell: (message) => (
        <div className="flex max-w-64 min-w-0 flex-col items-start">
          {/* The row opens the message; this is its keyboard way in */}
          <button
            type="button"
            className="max-w-full truncate text-left font-medium hover:underline"
            onClick={(event) => {
              event.stopPropagation()
              onOpen(message)
            }}
          >
            {message.name}
          </button>
          <span className="max-w-full truncate text-xs text-muted-foreground">{message.email}</span>
        </div>
      ),
    },
    {
      key: "subject",
      header: t(`${M}.columns.subject`),
      cell: (message) => (
        <div className="flex max-w-56 min-w-0 flex-col items-start">
          <span>{t(`${M}.subjects.${message.subject}`)}</span>
          {/* A booking request names its product (adr/0076 Ek 2026-11-23) */}
          {message.product_title ? (
            <span className="max-w-full truncate text-xs text-muted-foreground">
              {message.product_title}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "order",
      header: t(`${M}.columns.order`),
      className: "hidden sm:table-cell",
      cell: (message) =>
        message.order_number ? (
          <Link
            to="/orders"
            search={{ q: message.order_number }}
            className="tabular-nums hover:underline"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            #{message.order_number}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "message",
      header: t(`${M}.columns.message`),
      className: "hidden lg:table-cell",
      cell: (message) => (
        <span className="block max-w-96 truncate text-muted-foreground">{message.body}</span>
      ),
    },
  ]
}

/**
 * Müşteriler > İletişim mesajları (adr/0047 §6): what shoppers wrote from
 * the storefront's contact form. Waiting ones oldest first, answered ones
 * newest first; a message opens in full in a dialog.
 */
export function ContactMessagesPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const status: ContactStatus = search.status ?? "new"
  const page = (search.page ?? 1) - 1
  const subject: ContactSubject | undefined = search.subject
  // A phone number finds a request left without an e-mail (adr/0076 Ek 2026-11-23)
  const phone = search.phone ?? ""
  const list = useQuery(contactMessagesQuery(status, page, subject, phone.trim() || undefined))
  const walk = useRecordWalk(list.data?.contact_messages, (message) => message.id)
  const columns = useColumns(walk.show)
  const setSearch = (next: {
    status?: ContactStatus
    subject?: ContactSubject | typeof EVERY
    phone?: string
    page?: number
  }) => {
    const nextStatus = next.status ?? status
    const nextSubject = next.subject ?? subject
    const nextPhone = (next.phone ?? phone).trim()
    void navigate({
      to: "/customers/contact-messages",
      search: {
        status: nextStatus === "new" ? undefined : nextStatus,
        subject: nextSubject === EVERY ? undefined : nextSubject,
        phone: nextPhone === "" ? undefined : nextPhone,
        page: next.page && next.page > 1 ? next.page : undefined,
      },
      replace: true,
    })
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${M}.title`)} description={t(`${M}.description`)} />
      <CustomersNav />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        <FilterTabs
          label={t(`${M}.views`)}
          value={status}
          onChange={(next) => {
            setSearch({ status: next, page: 1 })
          }}
          tabs={[
            { key: "new", label: t(`${M}.tabs.new`) },
            { key: "handled", label: t(`${M}.tabs.handled`) },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <Select
            value={subject ?? EVERY}
            onValueChange={(next) => {
              setSearch({ subject: next as ContactSubject | typeof EVERY, page: 1 })
            }}
          >
            <SelectTrigger aria-label={t(`${M}.subjectFilter`)} className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EVERY}>{t(`${M}.allSubjects`)}</SelectItem>
              {CONTACT_SUBJECTS.map((key) => (
                <SelectItem key={key} value={key}>
                  {t(`${M}.subjects.${key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SearchInput
            value={phone}
            placeholder={t(`${M}.phoneFilter`)}
            onChange={(text) => {
              setSearch({ phone: text, page: 1 })
            }}
          />
        </div>
        {list.isError ? (
          <div className="p-5">
            <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={list.data?.contact_messages}
              rowKey={(message) => message.id}
              loading={list.isPending}
              onRowClick={walk.show}
              empty={
                <p className="text-center text-sm text-muted-foreground">
                  {t(`${M}.empty.${status}`)}
                </p>
              }
            />
            {list.data && list.data.count > CONTACT_PAGE_SIZE ? (
              <Pagination
                page={page}
                pageSize={CONTACT_PAGE_SIZE}
                count={list.data.count}
                onPageChange={(next) => {
                  setSearch({ page: next + 1 })
                }}
              />
            ) : null}
          </>
        )}
      </section>
      <ContactMessageDialog message={walk.open} steps={walk.steps} onClose={walk.close} />
    </div>
  )
}
