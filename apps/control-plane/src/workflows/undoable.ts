import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"

type Container = Pick<MedusaContainer, "resolve">

/**
 * A step that changes our own data and says how to put it back: `run`
 * returns its output and the undo's input (what the rows were), `undo`
 * restores them when a later step of the workflow fails. No secret and no
 * plaintext personal identifier goes in either (adr/0061 §4.3): a TCKN
 * arrives sealed.
 */
export function undoableStep<I, O, U>(
  name: string,
  run: (input: I, container: Container) => Promise<{ output: O; undo: U }>,
  undo: (undo: U, container: Container) => Promise<void>
) {
  return createStep<I, O, U>(
    name,
    async (input: I, { container }) => {
      const { output, undo: back } = await run(input, container)
      // The SDK types the undo as the output when it may be undefined; ours never is
      return new StepResponse(output, back) as StepResponse<O, U extends undefined ? O : U>
    },
    async (back, { container }) => {
      if (back !== undefined) {
        await undo(back, container)
      }
    }
  )
}
