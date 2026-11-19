import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { RichTextSection } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { switchVariant } from "@/features/storefront/layout/variants"
import { renderPanel } from "../section-panel.fixtures"
import { openGroup } from "../settings-groups.fixtures"
import { previewField } from "./preview-fields"
import { RichTextForm } from "./rich-text-form"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const PHOTO = { url: "http://localhost:9000/static/atolye.webp", alt: "Atölyede bileme" }
const body = { type: "doc", content: [{ type: "paragraph" }] }
const story = () =>
  ({ ...newHomeSection("rich_text", "hikayemiz1"), title: "Hakkımızda", body }) as RichTextSection

/** adr/0073 §3: the rich text's "Görselli metin" in the panel. */
describe("the rich text's picture variant", () => {
  it("starts as today's pane; a switch keeps the title and text and starts the picture's own", () => {
    expect(story()).toMatchObject({ variant: "pane" })
    const pictured = switchVariant(story(), "with_image")
    expect(pictured).toMatchObject({
      variant: "with_image",
      title: "Hakkımızda",
      body,
      image: null,
      image_side: "start",
    })
    expect(switchVariant({ ...pictured, image: PHOTO }, "pane")).toEqual(story())
  })

  it("is picked in Biçim, drawn small, and shows the picture and its side under İçerik", async () => {
    const user = userEvent.setup()
    const { changes } = renderPanel(story(), "home")
    await openGroup(user, "Biçim")
    const variants = screen.getByRole("group", { name: "Biçim" })
    expect(within(variants).getByRole("radio", { name: /Yalnız metin/ })).toBeChecked()
    expect(
      within(variants)
        .getByRole("radio", { name: /Görselli metin/ })
        .querySelector("svg")
    ).not.toBeNull()
    await user.click(within(variants).getByRole("radio", { name: /Görselli metin/ }))
    expect(changes.at(-1)).toMatchObject({ variant: "with_image", image: null })

    await openGroup(user, "İçerik")
    expect(screen.getByText("Görsel")).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "Sağda" }))
    expect(changes.at(-1)).toMatchObject({ image_side: "end", title: "Hakkımızda" })
    await user.click(screen.getByRole("button", { name: /Varsayılana dön/ }))
    expect(changes.at(-1)).toMatchObject({ image_side: "start" })
  })

  it("shows no picture field on the pane", async () => {
    const user = userEvent.setup()
    renderPanel(story(), "home")
    await openGroup(user, "İçerik")
    expect(screen.queryByText("Görsel")).toBeNull()
    expect(screen.queryByRole("radio", { name: "Sağda" })).toBeNull()
  })

  it("holds the draft until a picture is picked, then checks its words", () => {
    const pictured = switchVariant(story(), "with_image")
    expect(sectionProblems(story())).toEqual({})
    expect(sectionProblems(pictured)).toEqual({ image: "imageRequired" })
    expect(sectionProblems({ ...pictured, image: PHOTO })).toEqual({})
    expect(sectionProblems({ ...pictured, image: { ...PHOTO, alt: "x".repeat(400) } })).toEqual({
      image: "tooLong",
    })

    const client = new QueryClient()
    render(
      <QueryClientProvider client={client}>
        <RichTextForm section={pictured} problems={{ image: "imageRequired" }} onChange={vi.fn()} />
      </QueryClientProvider>
    )
    expect(screen.getByRole("alert")).toHaveTextContent(/görsel/i)
  })

  it("lands the preview's picture, title and text marks on their fields", () => {
    const pictured = switchVariant(story(), "with_image")
    expect(previewField(pictured, "image")).toEqual({
      target: "hikayemiz1-image",
      group: "content",
    })
    expect(previewField(pictured, "title")).toMatchObject({ target: "hikayemiz1-title" })
    expect(previewField(pictured, "body")).toMatchObject({ target: "hikayemiz1-body" })
    expect(previewField(story(), "image")).toBeNull()
  })
})
