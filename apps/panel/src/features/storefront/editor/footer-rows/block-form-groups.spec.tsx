import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { FOOTER_BLOCK_TYPES } from "@qticaret/types"
import "@/lib/i18n"
import { PANEL_GROUPS } from "../panel-groups"
import { BlockForm } from "./block-form"
import { FOOTER_ROWS_FIELD_IDS, blockGroup, fieldsOfBlock } from "./footer-rows-fields"
import { newBlock } from "./footer-rows-seed"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

/** adr/0070 §7: a block's panel draws each field in the group `panel-groups.ts` lists it under. */
describe("a footer block's panel groups", () => {
  it.each(FOOTER_BLOCK_TYPES)("%s: each field sits in its own group", (type) => {
    // a link field draws its control once it has a link
    const link = { kind: "url" as const, url: "https://example.com", label: "" }
    const block = type === "image" ? { ...newBlock("image", "blk"), link } : newBlock(type, "blk")
    const { unmount } = render(
      <QueryClientProvider client={new QueryClient()}>
        <BlockForm block={block} problems={{}} onChange={vi.fn()} menus={["Kurumsal"]} />
      </QueryClientProvider>
    )
    for (const field of fieldsOfBlock(block)) {
      const target = FOOTER_ROWS_FIELD_IDS.block(block.id, field)
      const element = document.getElementById(target)
      expect(element, `${type}.${field}: #${target} not drawn`).not.toBeNull()
      const holder = element?.closest<HTMLElement>("[data-panel-group]")?.dataset["panelGroup"]
      expect(holder, `${type}.${field} drawn in "${String(holder)}"`).toBe(blockGroup(field))
      expect(Object.hasOwn(PANEL_GROUPS, blockGroup(field))).toBe(true)
    }
    unmount()
  })
})
