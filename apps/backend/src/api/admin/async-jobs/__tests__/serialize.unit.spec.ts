import { publicInput } from "../serialize"

/**
 * What the admin API shows of a job's input. A picture job's one-off scene
 * (words the shop typed, adr/0071 Ek 2026-11-19) is shown as a mark only.
 */

const typed = {
  task: "image_scene",
  service: "gemini",
  funding: "own_key",
  custom: "mermer tezgah, yumuşak sabah ışığı",
  media_ids: ["media_01"],
  remember: false,
}

describe("a job's input in the admin API (publicInput)", () => {
  it("shows a typed scene as `scene: custom`, never its words", () => {
    const shown = publicInput(typed, "ai.image_edit") as Record<string, unknown>
    expect(shown).not.toHaveProperty("custom")
    expect(shown["scene"]).toBe("custom")
    expect(JSON.stringify(shown)).not.toContain("mermer")
    expect(shown).toMatchObject({ task: "image_scene", service: "gemini", media_count: 1 })
  })

  it("leaves a saved or pack scene's code as it is", () => {
    const saved = { task: "image_scene", scene: "own_abc123def456", media_ids: ["media_01"] }
    expect(publicInput(saved, "ai.image_edit")).toMatchObject({ scene: "own_abc123def456" })
  })

  it("keeps the other rules: a file id out, an address by its site, a list by its length", () => {
    expect(
      publicInput(
        {
          source_file_id: "file_1",
          feed_url: "https://old.example/feed?key=x",
          product_ids: ["a", "b"],
        },
        "catalog.import"
      )
    ).toEqual({ feed_url: "https://old.example/…", product_count: 2 })
  })
})
