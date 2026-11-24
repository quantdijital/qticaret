import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { JSONContent } from "@tiptap/react"
import type { ProgramTag, ProgramUnit } from "@qticaret/types"
import { sdk } from "@/lib/sdk"

export { PROGRAM_LIMITS, PROGRAM_TAGS, PROGRAM_UNITS } from "@qticaret/types"
export type { ProgramTag, ProgramUnit } from "@qticaret/types"

/** A step's picture from the media library: its address and alt text. */
export interface ProgramImage {
  url: string
  alt: string | null
}

/** One step as the server keeps it (adr/0078); its body a short content document. */
export interface ProgramStep {
  label: string | null
  title: string
  body: JSONContent | null
  image: ProgramImage | null
  tags: ProgramTag[]
}

export interface Program {
  unit: ProgramUnit
  steps: ProgramStep[]
}

/** `GET /admin/products/:id/program`: no steps (and the day unit) until one is saved. */
export interface ProgramAnswer {
  booking_mode: string
  program: Program
}

const programPath = (id: string) => `/admin/products/${encodeURIComponent(id)}/program`

export const programQuery = (productId: string) =>
  queryOptions({
    queryKey: ["products", "booking", productId, "program"],
    queryFn: () => sdk.client.fetch<ProgramAnswer>(programPath(productId)),
  })

/** Saves the whole program; no steps clears it. The answer is the program as kept. */
export function useSaveProgram(productId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (program: Program) =>
      sdk.client.fetch<ProgramAnswer>(programPath(productId), {
        method: "POST",
        body: program,
      }),
    onSuccess: async (answer) => {
      client.setQueryData(programQuery(productId).queryKey, answer)
      // The advisor's program hint (P-CONT-10) reads it again
      await client.invalidateQueries({ queryKey: ["seo"] })
    },
  })
}
