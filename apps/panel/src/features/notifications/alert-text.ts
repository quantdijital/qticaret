import {
  Bell,
  Calculator,
  FileWarning,
  Mail,
  PackageMinus,
  Scale,
  ShieldAlert,
  Unlink,
  Webhook,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { isContactSubject } from "@/features/customers/api/contact-messages"
import { paymentIssueAlert } from "@/features/notifications/payment-issue-alert"
import { returnRefundAlert } from "@/features/notifications/return-alert"
import { stockShortAlert } from "@/features/notifications/stock-short-alert"
import { wholesaleOrderAlert } from "@/features/notifications/wholesale-alert"
import { paymentLinkAlert } from "@/features/payment-links/components/link-alert"
import { isConnectable } from "@/features/settings/payment-methods"
import { formatDate } from "@qticaret/admin-ui/lib/format"

const text = (value: unknown): string => (typeof value === "string" ? value : "")
const amount = (value: unknown): number => (typeof value === "number" ? value : 0)

/** What an alert says and where it leads, worded here from its data (adr/0020). */
export function useAlertText(data: Record<string, unknown>) {
  const { t } = useTranslation()
  const alert =
    paymentLinkAlert(t, data) ??
    returnRefundAlert(t, data) ??
    stockShortAlert(t, data) ??
    paymentIssueAlert(t, data) ??
    wholesaleOrderAlert(t, data)
  if (alert) {
    return alert
  }
  if (data["kind"] === "low_stock") {
    return {
      title: t("notifications.lowStock.title", { name: text(data["name"]) }),
      description: t("notifications.lowStock.description", {
        count: amount(data["available"]),
        threshold: amount(data["threshold"]),
      }),
      Icon: PackageMinus,
      tone: "bg-warning-soft text-warning-text",
      link: { to: "/inventory" as const, search: { view: "low" }, params: {} },
    }
  }
  if (data["kind"] === "provider_account") {
    const changes = Array.isArray(data["changes"]) ? data["changes"].map(text) : []
    // Only an owner changes an account (adr/0040): one without a name is "the owner"
    const who =
      text(data["actor"]) || (data["actor_id"] ? t("notifications.providerAccount.owner") : "")
    const provider = text(data["provider"])
    return {
      title: t("notifications.providerAccount.title", {
        provider: t(`settings.payments.methods.${provider}.name`, { defaultValue: provider }),
      }),
      description: [
        changes.map((change) => t(`notifications.providerAccount.changes.${change}`)).join(", "),
        who ? t("notifications.providerAccount.by", { who }) : "",
      ]
        .filter(Boolean)
        .join(" · "),
      Icon: ShieldAlert,
      tone: "bg-info-soft text-info-text",
      // Straight to the provider's page; one the panel does not know opens the list
      link: isConnectable(provider)
        ? { to: "/settings/payments/$provider" as const, search: {}, params: { provider } }
        : { to: "/settings/payments" as const, search: {}, params: {} },
    }
  }
  if (data["kind"] === "webhook_disabled") {
    return {
      title: t("notifications.webhookDisabled.title", { host: text(data["host"]) }),
      description: t("notifications.webhookDisabled.description"),
      Icon: Webhook,
      tone: "bg-destructive-soft text-destructive-text",
      link: { to: "/settings/api" as const, search: {}, params: {} },
    }
  }
  if (data["kind"] === "einvoice_return_needed") {
    return {
      title: t("notifications.einvoiceReturnNeeded.title", { order: text(data["display_id"]) }),
      description: t("notifications.einvoiceReturnNeeded.description"),
      Icon: FileWarning,
      tone: "bg-destructive-soft text-destructive-text",
      link: { to: "/orders/$id" as const, search: {}, params: { id: text(data["order_id"]) } },
    }
  }
  if (data["kind"] === "einvoice_return_document") {
    const document = data["document"] === "return_invoice" ? "returnInvoice" : "expenseVoucher"
    return {
      title: t(`notifications.einvoiceReturnDocument.${document}.title`, {
        order: text(data["display_id"]),
      }),
      description: t(`notifications.einvoiceReturnDocument.${document}.description`),
      Icon: FileWarning,
      tone: "bg-warning-soft text-warning-text",
      link: { to: "/orders/$id" as const, search: {}, params: { id: text(data["order_id"]) } },
    }
  }
  if (data["kind"] === "fraud_review") {
    return {
      title: t("notifications.fraudReview.title", {
        number: text(data["number"]),
        score: text(data["score"]),
      }),
      description: t("notifications.fraudReview.description"),
      Icon: ShieldAlert,
      tone: "bg-warning-soft text-warning-text",
      link: { to: "/orders/review" as const, search: {}, params: {} },
    }
  }
  if (data["kind"] === "migration_not_found") {
    return {
      title: t("notifications.migrationNotFound.title", { count: amount(data["count"]) }),
      description: t("notifications.migrationNotFound.description"),
      Icon: Unlink,
      tone: "bg-warning-soft text-warning-text",
      link: { to: "/settings/migration" as const, search: {}, params: {} },
    }
  }
  if (data["kind"] === "contact_message") {
    // The server's own wording carries the sender's name in Turkish; the panel words it from the subject
    const subject = isContactSubject(data["subject"]) ? data["subject"] : "other"
    // A KVKK request carries the law's last day for the answer (adr/0047)
    const due = text(data["due_at"])
    const dueDay = due && !Number.isNaN(Date.parse(due)) ? formatDate(due) : null
    return {
      title: t("notifications.contactMessage.title", {
        subject: t(`customers.contactMessages.subjects.${subject}`),
      }),
      description: [
        t("notifications.contactMessage.description"),
        dueDay ? t("notifications.contactMessage.due", { date: dueDay }) : "",
      ]
        .filter(Boolean)
        .join(" "),
      Icon: Mail,
      tone: "bg-info-soft text-info-text",
      link: { to: "/customers/contact-messages" as const, search: {}, params: {} },
    }
  }
  if (data["kind"] === "einvoice_stopped") {
    const order = text(data["order_id"])
    return {
      title: t("notifications.einvoiceStopped.title", { order: text(data["display_id"]) }),
      description: t("notifications.einvoiceStopped.description"),
      Icon: FileWarning,
      tone: "bg-destructive-soft text-destructive-text",
      link: { to: "/orders/$id" as const, search: {}, params: { id: order } },
    }
  }
  if (data["kind"] === "accounting_sync") {
    return {
      title: t("notifications.accountingSync.title"),
      description: t("notifications.accountingSync.description"),
      Icon: Calculator,
      tone: "bg-destructive-soft text-destructive-text",
      link: {
        to: "/settings/einvoice" as const,
        search: { part: "accounting" },
        params: {},
      },
    }
  }
  if (data["kind"] === "statement_check") {
    const provider = text(data["provider"])
    const day = text(data["day"])
    return {
      title: t("notifications.statementCheck.title", {
        provider: t(`settings.payments.methods.${provider}.name`, { defaultValue: provider }),
        day: day.split("-").reverse().join("."),
      }),
      description: t("notifications.statementCheck.description", {
        count: amount(data["issues"]),
      }),
      Icon: Scale,
      tone: "bg-warning-soft text-warning-text",
      // The day itself on the finance report, where its differences are listed
      link: { to: "/reports/finance" as const, search: { from: day, to: day }, params: {} },
    }
  }
  return {
    title: text(data["title"]),
    description: text(data["description"]),
    Icon: Bell,
    tone: "bg-muted text-muted-foreground",
    link: null,
  }
}
