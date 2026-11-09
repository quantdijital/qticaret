import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Info, Loader2, Mail, MessageCircle, Package, Phone, User } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DetailDialog } from "@/components/patterns/detail-dialog"
import { RecordStepper } from "@/components/patterns/record-stepper"
import type { RecordSteps } from "@/components/patterns/record-stepper"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DialogBody, DialogSection } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  abandonedCartQuery,
  useRemindCart,
  whatsappLink,
} from "@/features/customers/api/abandoned-carts"
import type { AbandonedCartDetail } from "@/features/customers/api/abandoned-carts"
import { ReminderBadge } from "@/features/customers/components/reminder-badge"
import { errorText } from "@/lib/errors"
import { formatDateTime, formatMoney, formatPhone } from "@/lib/format"

const C = "customers.abandoned"

function Fact({ icon: Icon, children }: { icon: typeof Mail; children: ReactNode }) {
  return (
    <p className="flex min-w-0 items-start gap-2.5 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  )
}

function Lines({ cart }: { cart: AbandonedCartDetail }) {
  const { t } = useTranslation()
  return (
    <ul className="flex flex-col divide-y">
      {cart.lines.map((line, index) => (
        <li key={`${line.title}-${String(index)}`} className="flex items-center gap-3 py-2.5">
          {line.thumbnail ? (
            <img
              src={line.thumbnail}
              alt=""
              className="size-10 shrink-0 rounded-md border object-cover"
            />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
              <Package className="size-4 text-muted-foreground" aria-hidden="true" />
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{line.title}</span>
            {line.variant ? (
              <span className="truncate text-xs text-muted-foreground">{line.variant}</span>
            ) : null}
          </span>
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {t(`${C}.quantity`, { count: line.quantity })}
          </span>
        </li>
      ))}
      <li className="flex items-center justify-between py-2.5 text-sm font-medium">
        <span>{t(`${C}.total`)}</span>
        <span className="tabular-nums">{formatMoney(cart.total, cart.currency_code)}</span>
      </li>
    </ul>
  )
}

function consentText(t: (key: string) => string, consent: "granted" | "revoked" | null) {
  return t(consent === "granted" ? `${C}.consent.granted` : `${C}.consent.none`)
}

function Body({ cart }: { cart: AbandonedCartDetail }) {
  const { t } = useTranslation()
  return (
    <DialogBody>
      <DialogSection title={t(`${C}.who`)}>
        <div className="flex flex-col gap-2.5">
          {cart.customer ? (
            <Fact icon={User}>
              <Link
                to="/customers/$id"
                params={{ id: cart.customer.id }}
                className="font-medium hover:underline"
              >
                {cart.name ?? cart.email}
              </Link>{" "}
              <StatusBadge tone={cart.customer.has_account ? "info" : "neutral"}>
                {t(
                  cart.customer.has_account ? "customers.kind.registered" : "customers.kind.guest"
                )}
              </StatusBadge>
            </Fact>
          ) : cart.name ? (
            <Fact icon={User}>{cart.name}</Fact>
          ) : null}
          {cart.email ? (
            <Fact icon={Mail}>
              <a href={`mailto:${cart.email}`} className="hover:underline">
                {cart.email}
              </a>
              <span className="text-muted-foreground">
                {" · "}
                {consentText(t, cart.consent.email)}
              </span>
            </Fact>
          ) : null}
          {cart.phone ? (
            <Fact icon={Phone}>
              <a href={`tel:${cart.phone}`} className="tabular-nums hover:underline">
                {formatPhone(cart.phone)}
              </a>
              <span className="text-muted-foreground">
                {" · "}
                {consentText(t, cart.consent.sms)}
              </span>
            </Fact>
          ) : null}
        </div>
      </DialogSection>
      <DialogSection title={t(`${C}.lines`, { count: cart.line_count })}>
        <Lines cart={cart} />
      </DialogSection>
      <DialogSection title={t(`${C}.reminderTitle`)}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <ReminderBadge reminder={cart.reminder} />
          {cart.reminder ? (
            <span className="text-muted-foreground">{formatDateTime(cart.reminder.at)}</span>
          ) : null}
        </div>
        {cart.actions.email_block ? (
          <Alert role="status">
            <Info aria-hidden="true" />
            <AlertDescription>{t(`${C}.block.${cart.actions.email_block}`)}</AlertDescription>
          </Alert>
        ) : null}
      </DialogSection>
    </DialogBody>
  )
}

function Actions({ cart }: { cart: AbandonedCartDetail }) {
  const { t } = useTranslation()
  const remind = useRemindCart(cart.id)
  const firstName = cart.name?.split(" ")[0] ?? ""
  const text = t(firstName ? `${C}.whatsappText` : `${C}.whatsappTextNoName`, { name: firstName })
  return (
    <>
      {cart.actions.whatsapp ? (
        <Button type="button" variant="outline" asChild>
          <a href={whatsappLink(cart.actions.whatsapp, text)} target="_blank" rel="noreferrer">
            <MessageCircle />
            {t(`${C}.whatsapp`)}
          </a>
        </Button>
      ) : null}
      <Button
        type="button"
        disabled={cart.actions.email_block !== null || remind.isPending}
        title={cart.actions.email_block ? t(`${C}.block.${cart.actions.email_block}`) : undefined}
        onClick={() => {
          remind.mutate(undefined, {
            onSuccess: ({ outcome }) => {
              if (outcome === "sent") {
                toast.success(t(`${C}.reminded`))
              } else {
                toast.warning(
                  t(`customers.messages.reason.${outcome}`, { defaultValue: t(`${C}.notSent`) })
                )
              }
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      >
        {remind.isPending ? <Loader2 className="animate-spin" /> : <Mail />}
        {t(`${C}.remind`)}
      </Button>
    </>
  )
}

/**
 * One cart left behind in the standard window (2026-11-06): who, what,
 * the reminder and consent; "E-posta ile hatırlat" only with commercial
 * e-mail consent (İYS; otherwise off, with the reason), "WhatsApp'tan yaz"
 * only for a consenting mobile. No restore link: the reminder's link is
 * kept as a hash only and goes to the shopper alone.
 */
export function AbandonedCartDialog({
  cartId,
  steps,
  onClose,
}: {
  cartId: string | null
  /** The cart's place on the list's page: ‹ n / m › walks it. */
  steps: RecordSteps
  onClose: () => void
}) {
  const { t } = useTranslation()
  const query = useQuery({ ...abandonedCartQuery(cartId ?? ""), enabled: cartId !== null })
  const cart = query.data?.id === cartId ? query.data : undefined
  return (
    <DetailDialog
      open={cartId !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      pane
      title={cart ? (cart.name ?? cart.email ?? t(`${C}.title`)) : t(`${C}.title`)}
      description={
        cart
          ? t(`${C}.lastActivity`, { date: formatDateTime(cart.updated_at) })
          : t("common.loading")
      }
      headerAction={
        <RecordStepper {...steps} previousLabel={t(`${C}.previous`)} nextLabel={t(`${C}.next`)} />
      }
      footer={cart ? <Actions cart={cart} /> : undefined}
    >
      {cart ? (
        <Body cart={cart} />
      ) : query.isError ? (
        <DialogBody>
          <Alert variant="destructive">
            <Info aria-hidden="true" />
            <AlertDescription>{errorText(t, query.error)}</AlertDescription>
          </Alert>
        </DialogBody>
      ) : (
        <DialogBody>
          <Skeleton className="h-48" />
        </DialogBody>
      )}
    </DetailDialog>
  )
}
