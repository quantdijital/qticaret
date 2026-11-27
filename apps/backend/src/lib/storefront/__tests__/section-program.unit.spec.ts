import path from "node:path"
import { PROGRAM_PLACES, program } from "../sections/program"

const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-variants.ts"
)

const ALWAYS = { visible: true, starts_at: null, ends_at: null }
const section = (extra: Record<string, unknown>) =>
  program.safeParse({ id: "program001", type: "program", title: null, ...ALWAYS, ...extra })

/** A dated product's program (adr/0078): its own section by default, or a tab beside the description. */
describe("the program section's place", () => {
  it("holds the contract's list", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(PROGRAM_PLACES).toEqual(contract["PROGRAM_PLACES"])
  })

  it("takes none (today's section), each place on its list, and refuses one off it", () => {
    expect(section({}).success).toBe(true)
    for (const place of PROGRAM_PLACES) {
      const read = section({ place, variant: "accordion" })
      expect(read.success && read.data.place).toBe(place)
    }
    expect(section({ place: "side" }).success).toBe(false)
  })
})
