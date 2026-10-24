import type { ExecArgs } from "@medusajs/framework/types"
import { seedDemo } from "./seed"

/** Usage: pnpm --filter @qticaret/backend seed:demo (development and demos only) */
export default async function run({ container }: ExecArgs): Promise<void> {
  await seedDemo(container)
}
