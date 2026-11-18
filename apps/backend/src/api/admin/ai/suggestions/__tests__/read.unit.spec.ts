import { CONTENT_DRAFTS_MODULE } from "../../../../../modules/content-drafts"
import { MEDIA_MODULE } from "../../../../../modules/media"
import { STAFF_ROLES_MODULE } from "../../../../../modules/staff-roles"
import { AdminGetAiSuggestions } from "../../validators"
import { readOpenAltSuggestions } from "../read"

const at = (minute: number) => new Date(Date.UTC(2026, 10, 18, 10, minute))

function container(
  role: string | null,
  drafts: Record<string, unknown>[],
  assets: Record<string, unknown>[]
) {
  const listContentDrafts = jest.fn().mockResolvedValue(drafts)
  const listMediaAssets = jest.fn().mockResolvedValue(assets)
  const services: Record<string, unknown> = {
    [STAFF_ROLES_MODULE]: { roleOf: jest.fn().mockResolvedValue(role) },
    [CONTENT_DRAFTS_MODULE]: { listContentDrafts },
    [MEDIA_MODULE]: { listMediaAssets },
  }
  return {
    scope: { resolve: (name: string) => services[name] } as never,
    listContentDrafts,
    listMediaAssets,
  }
}

describe("readOpenAltSuggestions", () => {
  it("keeps the newest open suggestion per image, for images that still exist", async () => {
    const { scope, listContentDrafts, listMediaAssets } = container(
      "admin",
      [
        {
          id: "cdraft_3",
          entity_id: "media_a",
          text: "Yeni",
          provider: "gemini",
          created_at: at(3),
        },
        {
          id: "cdraft_2",
          entity_id: "media_gone",
          text: "Yok",
          provider: "gemini",
          created_at: at(2),
        },
        { id: "cdraft_1", entity_id: "media_a", text: "Eski", provider: "fake", created_at: at(1) },
      ],
      [{ id: "media_a", url: "https://cdn/a.jpg", file_id: "a.jpg", filename: null, alt: null }]
    )

    const open = await readOpenAltSuggestions(scope, "user_1")

    expect(open).toEqual([
      {
        id: "cdraft_3",
        service: "gemini",
        text: "Yeni",
        created_at: at(3),
        media: {
          id: "media_a",
          url: "https://cdn/a.jpg",
          filename: expect.any(String) as unknown,
          alt: null,
        },
      },
    ])
    expect(listContentDrafts).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "image_alt_text",
        entity_type: "media",
        source: "ai_suggestion",
        status: "draft",
      }),
      expect.objectContaining({ take: 100, order: { created_at: "DESC", id: "DESC" } })
    )
    expect(listMediaAssets).toHaveBeenCalledWith(
      { id: ["media_a", "media_gone"] },
      expect.anything()
    )
  })

  it("reads no image when nothing waits", async () => {
    const { scope, listMediaAssets } = container("owner", [], [])
    expect(await readOpenAltSuggestions(scope, "user_1")).toEqual([])
    expect(listMediaAssets).not.toHaveBeenCalled()
  })

  it.each([["operations"], ["readonly"], [null]])("refuses the role %s", async (role) => {
    const { scope, listContentDrafts } = container(role, [], [])
    await expect(readOpenAltSuggestions(scope, "user_1")).rejects.toMatchObject({
      message: "staff.forbidden",
    })
    expect(listContentDrafts).not.toHaveBeenCalled()
  })
})

describe("AdminGetAiSuggestions", () => {
  it("takes the image task only", () => {
    expect(AdminGetAiSuggestions.safeParse({ task: "image_alt_text" }).success).toBe(true)
    expect(AdminGetAiSuggestions.safeParse({ task: "seo_title" }).success).toBe(false)
    expect(AdminGetAiSuggestions.safeParse({}).success).toBe(false)
    expect(
      AdminGetAiSuggestions.safeParse({ task: "image_alt_text", status: "approved" }).success
    ).toBe(false)
  })
})
