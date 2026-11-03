import type { ExecArgs } from "@medusajs/framework/types"
import { parseEnv } from "../lib/env"
import { parseTestCustomerArgs } from "./test-customer/args"
import { createTestCustomer } from "./test-customer/create"

/**
 * Usage: NODE_ENV=development pnpm --filter @qticaret/backend customer:test <email> <password>
 *
 * A storefront customer for trying the shop by hand: signs in with this
 * e-mail and password at once, the address already confirmed (adr/0037 §1).
 * Run again, the password is set anew. Development and test databases
 * only; the password is never printed or logged.
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  const input = parseTestCustomerArgs(args, parseEnv().NODE_ENV)
  const { created } = await createTestCustomer(container, input)
  // The address only: the person running it typed the password
  process.stdout.write(`customer:test: ${created ? "created" : "updated"} ${input.email}\n`)
}
