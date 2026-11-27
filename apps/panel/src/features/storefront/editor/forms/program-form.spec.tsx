import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProgramSection } from "@/features/storefront/api/layout"
import { ProgramForm } from "./program-form"

// A dated product's program: its own section leaves no field behind
const SECTION: ProgramSection = {
  id: "program001",
  type: "program",
  visible: true,
  starts_at: null,
  ends_at: null,
  title: null,
  variant: "timeline",
}

const SWITCH = "Açıklama sekmelerinde göster"

function draw(section: ProgramSection) {
  const onChange = vi.fn<(section: ProgramSection) => void>()
  render(<ProgramForm section={section} problems={{}} onChange={onChange} />)
  return onChange
}

describe("the program's form", () => {
  it("puts the program among the description's tabs, and its own section back as no field", () => {
    const onChange = draw(SECTION)
    expect(screen.getByRole("switch", { name: SWITCH })).not.toBeChecked()
    fireEvent.click(screen.getByRole("switch", { name: SWITCH }))
    expect(onChange).toHaveBeenLastCalledWith({ ...SECTION, place: "tab" })
    cleanup()
    const tabbed = draw({ ...SECTION, place: "tab" })
    expect(screen.getByRole("switch", { name: SWITCH })).toBeChecked()
    fireEvent.click(screen.getByRole("switch", { name: SWITCH }))
    expect(tabbed).toHaveBeenLastCalledWith(SECTION)
  })
})
