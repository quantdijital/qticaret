import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { clearDesigns, helpBox, staffClient, storedDesigns, withCutlery } from "../helpers/designs"
import type { Draft } from "../helpers/designs"
import type { HttpClient } from "../helpers/http"

jest.setTimeout(240 * 1000)

/**
 * The looks are the owner's alone (2026-11-23): an admin's discard or
 * restore still keeps the replaced draft as an automatic save, but never
 * removes the owner's to make room; the owner's next one trims to five.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("lets an admin's discards and restores keep the draft without removing the owner's saves", async () => {
      const container = getContainer()
      await clearDesigns(container)
      await withCutlery(container)
      const owner = staffClient(http, (await createAdminUser(http, container)).headers)
      const admin = staffClient(http, (await createAdminUser(http, container, "admin")).headers)
      const opened = await owner.layout()
      const own: Draft = { ...opened.draft, home: [helpBox("yardimkutusu", "Yayında")] }
      expect((await owner.saveDraft(own)).status).toBe(200)
      const published = await owner.post<{ layout: { revision: number } }>(
        "/admin/storefront-layout/publish"
      )
      expect(published.status).toBe(200)
      const revision = published.data.layout.revision

      const titleOf = (row: { document: { home?: unknown[] } }) =>
        (row.document.home?.[0] as { title?: string } | undefined)?.title
      const autoTitles = async () =>
        (await storedDesigns(container))
          .filter((row) => row.kind === "auto")
          .map(titleOf)
          .sort()
      const replace = async (who: typeof owner, title: string, how: "discard" | "restore") => {
        expect(
          (await who.saveDraft({ ...own, home: [helpBox("yardimkutusu", title)] })).status
        ).toBe(200)
        const path =
          how === "discard"
            ? "/admin/storefront-layout/discard"
            : `/admin/storefront-layout/revisions/${String(revision)}/restore`
        const answer = await who.post<{ auto_saved: { kind: string } | null }>(path)
        expect(answer.status).toBe(200)
        // The replaced draft is kept, whoever replaced it
        expect(answer.data.auto_saved).toMatchObject({ kind: "auto" })
      }

      const owners = ["Sahip 1", "Sahip 2", "Sahip 3", "Sahip 4", "Sahip 5"]
      for (const title of owners) {
        await replace(owner, title, "discard")
      }
      expect(await autoTitles()).toEqual([...owners].sort())

      // Six by an admin, discards and restores: all kept, none of the owner's removed
      const admins = [
        "Yönetici 1",
        "Yönetici 2",
        "Yönetici 3",
        "Yönetici 4",
        "Yönetici 5",
        "Yönetici 6",
      ]
      for (const [index, title] of admins.entries()) {
        await replace(admin, title, index % 2 === 0 ? "discard" : "restore")
      }
      expect(await autoTitles()).toEqual([...owners, ...admins].sort())

      // The owner's next one trims back to five, the oldest first
      await replace(owner, "Sahip 6", "discard")
      expect(await autoTitles()).toEqual(
        ["Yönetici 3", "Yönetici 4", "Yönetici 5", "Yönetici 6", "Sahip 6"].sort()
      )
    })
  },
})
