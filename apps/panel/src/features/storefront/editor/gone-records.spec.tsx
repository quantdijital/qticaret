import { render, screen } from "@testing-library/react"
import { LayoutGrid } from "lucide-react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { GoneRecordsContext } from "./gone-records-context"
import { SectionRow } from "./section-row"

/** A row of the tree, the server's gone-record parts given (`missing_targets`). */
function row(gone: ReadonlySet<string>) {
  render(
    <GoneRecordsContext.Provider value={gone}>
      <ul>
        <SectionRow
          id="kategoriler"
          icon={LayoutGrid}
          name="Kategoriler"
          detail={null}
          visible
          scheduled={false}
          problem={false}
          onOpen={vi.fn()}
          onToggle={vi.fn()}
          onRemove={vi.fn()}
        />
      </ul>
    </GoneRecordsContext.Provider>
  )
}

describe("a section naming a deleted record", () => {
  it("is marked in the tree with what to do, not as a problem that holds the save", () => {
    row(new Set(["kategoriler"]))

    expect(
      screen.getByRole("img", { name: "Gösterdiği kayıt silinmiş; yeniden seçin" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("img", { name: "Düzeltilecek alan var" })).toBeNull()
  })

  it("is not marked while its records are there", () => {
    row(new Set(["baskabolum"]))

    expect(screen.queryByRole("img", { name: /kayıt silinmiş/ })).toBeNull()
  })
})
