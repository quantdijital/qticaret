import { randomUUID } from "node:crypto"
import { z } from "@medusajs/framework/zod"
import { customerData } from "../../legal/customer-data"
import type { JobType } from "./types"

const input = z.object({ customer_id: z.string().regex(/^cus_[0-9A-Za-z]{1,40}$/) }).strict()

/**
 * A customer's data as their KVKK request asks (F13.5, adr/0041 §6): one
 * JSON file, readable as it is. Queued only by the request it answers;
 * the job and its file are its asker's and the owner's, and each download
 * is a recorded read.
 */
export const customerDataExport: JobType<z.infer<typeof input>> = {
  input,
  singleton: false,
  resultTtlDays: 7,
  containsPersonalData: true,
  privateToAsker: true,
  internal: true,
  execute: async ({ container, progress, resultFile }, { customer_id: customerId }) => {
    await progress(10)
    const data = await customerData(container, customerId)
    const file = await resultFile(`kisisel-veri-${randomUUID()}.json`, "application/json")
    await file.write(JSON.stringify(data, null, 2))
    await progress(100)
    return { summary: { orders: data.siparişler.length } }
  },
}
