import { MedusaService } from "@medusajs/framework/utils"
import { OrderRefund } from "./models/order-refund"

export interface RefundLine {
  id: string
  kind: "item" | "shipping"
  quantity: number
  /** Kuruş. */
  net: number
}

/** What an order's lines gave back so far: units and kuruş, by line id. */
export interface RefundedLines {
  units: Map<string, number>
  net: Map<string, number>
}

/** One part of a refund a provider makes in parts (iyzico): kuruş, and whether its answer came. */
export interface ProviderPart {
  transaction_id: string
  amount: number
  state: "sending" | "done"
}

/** The order refund ledger (F5 V5): read and written inside the order's refund lock. */
class OrderRefundsModuleService extends MedusaService({ OrderRefund }) {
  /** The refund under `reference`: its payment and its parts; null when there is no such refund. */
  async providerParts(
    reference: string
  ): Promise<{ payment_id: string; parts: ProviderPart[] } | null> {
    const [entry] = await this.listOrderRefunds({ reference }, { take: 1 })
    return entry
      ? {
          payment_id: entry.payment_id,
          parts: (entry.provider_parts as ProviderPart[] | null) ?? [],
        }
      : null
  }

  /** Every part sent for a payment, under any reference and whatever became of its refund. */
  async paymentParts(paymentId: string): Promise<ProviderPart[]> {
    const entries = await this.listOrderRefunds(
      { payment_id: paymentId },
      { select: ["provider_parts"] }
    )
    return entries.flatMap((entry) => (entry.provider_parts as ProviderPart[] | null) ?? [])
  }

  async saveProviderParts(reference: string, parts: ProviderPart[]): Promise<void> {
    const [entry] = await this.listOrderRefunds({ reference }, { take: 1 })
    if (entry) {
      await this.updateOrderRefunds({
        id: entry.id,
        provider_parts: parts as unknown as Record<string, unknown>,
      })
    }
  }

  /** Lines given back by the refunds that went through, or are going through now. */
  async refundedLines(orderId: string): Promise<RefundedLines> {
    const refunds = await this.listOrderRefunds(
      { order_id: orderId, status: ["pending", "done"] },
      { select: ["lines"] }
    )
    const units = new Map<string, number>()
    const net = new Map<string, number>()
    for (const refund of refunds) {
      for (const line of refund.lines as unknown as RefundLine[]) {
        units.set(line.id, (units.get(line.id) ?? 0) + line.quantity)
        net.set(line.id, (net.get(line.id) ?? 0) + line.net)
      }
    }
    return { units, net }
  }
}

export default OrderRefundsModuleService
