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

/** The order refund ledger (F5 V5): read and written inside the order's refund lock. */
class OrderRefundsModuleService extends MedusaService({ OrderRefund }) {
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
