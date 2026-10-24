import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { URL_REGISTRY_MODULE } from ".."
import { uniqueViolationKeys } from "../../../lib/errors"
import type UrlRegistryModuleService from "../service"

jest.setTimeout(120 * 1000)

const PRODUCT = { entity_type: "product", entity_id: "prod_1" }
const OTHER = { entity_type: "product_category", entity_id: "pcat_1" }
const OLD = { locale: "tr", path: "/urun/sef-bicagi" }
const NEW = { locale: "tr", path: "/urun/sef-bicagi-20-cm" }

const reasonOf = async (run: Promise<unknown>): Promise<unknown> => {
  try {
    await run
  } catch (error) {
    const fields = error as { safeMessage?: unknown; message?: unknown }
    return fields.safeMessage ?? fields.message
  }
  return "no error"
}

moduleIntegrationTestRunner<UrlRegistryModuleService>({
  moduleName: URL_REGISTRY_MODULE,
  resolve: "./src/modules/url-registry",
  testSuite: ({ service }) => {
    describe("claimPath", () => {
      it("gives a free path to a record", async () => {
        const claim = await service.claimPath({ ...OLD, ...PRODUCT })

        expect(claim).toMatchObject({ previousStatus: "none", replacedPaths: [] })
        expect(claim.entry).toMatchObject({ ...OLD, ...PRODUCT, status: "active" })
        expect(await service.resolvePath(OLD)).toEqual({ ...PRODUCT, status: "active" })
      })

      it("returns the record's own active path unchanged", async () => {
        const first = await service.claimPath({ ...OLD, ...PRODUCT })
        const second = await service.claimPath({ ...OLD, ...PRODUCT })

        expect(second.entry.id).toBe(first.entry.id)
        expect(second.previousStatus).toBe("active")
        expect(await service.listUrlEntries()).toHaveLength(1)
      })

      it("refuses a path another record holds, active or reserved (F2 KK)", async () => {
        await service.claimPath({ ...OLD, ...PRODUCT })

        expect(await reasonOf(service.claimPath({ ...OLD, ...OTHER }))).toBe("seo.path_taken")
        await service.releasePath({ ...OLD, ...PRODUCT })
        expect(await reasonOf(service.claimPath({ ...OLD, ...OTHER }))).toBe("seo.path_taken")
      })

      it("lets the same path exist once per locale", async () => {
        await service.claimPath({ ...OLD, ...PRODUCT })
        const english = await service.claimPath({ ...OLD, locale: "en", ...OTHER })

        expect(english.entry.status).toBe("active")
      })

      it("reserves the record's earlier path when it claims a new one (a slug change)", async () => {
        await service.claimPath({ ...OLD, ...PRODUCT })

        const claim = await service.claimPath({ ...NEW, ...PRODUCT })

        expect(claim).toMatchObject({ previousStatus: "none", replacedPaths: [OLD.path] })
        expect(await service.resolvePath(OLD)).toMatchObject({ status: "reserved" })
        expect(await service.resolvePath(NEW)).toMatchObject({ status: "active" })
      })

      it("activates a reserved path again when the slug changes back", async () => {
        await service.claimPath({ ...OLD, ...PRODUCT })
        await service.claimPath({ ...NEW, ...PRODUCT })

        const claim = await service.claimPath({ ...OLD, ...PRODUCT })

        expect(claim).toMatchObject({ previousStatus: "reserved", replacedPaths: [NEW.path] })
        expect(await service.resolvePath(OLD)).toMatchObject({ status: "active" })
        expect(await service.resolvePath(NEW)).toMatchObject({ status: "reserved" })
      })

      it("lets exactly one of ten concurrent claims win, the rest get seo.path_taken", async () => {
        const results = await Promise.allSettled(
          Array.from({ length: 10 }, (_, index) =>
            service.claimPath({
              ...OLD,
              entity_type: "product",
              entity_id: `prod_${String(index)}`,
            })
          )
        )

        const rejected = results.filter((result) => result.status === "rejected")
        expect(results.length - rejected.length).toBe(1)
        expect(
          rejected.map((result) => (result.reason as { safeMessage?: unknown }).safeMessage)
        ).toEqual(Array.from({ length: 9 }, () => "seo.path_taken"))
      })

      it.each([
        ["uppercase", { ...OLD, path: "/Urun/Sef" }, "seo.path_invalid"],
        ["no leading slash", { ...OLD, path: "urun/x" }, "seo.path_invalid"],
        ["a trailing slash", { ...OLD, path: "/urun/x/" }, "seo.path_invalid"],
        ["a digits-only segment", { ...OLD, path: "/marka/4711" }, "seo.path_invalid"],
        [
          "a segment over 80 characters",
          { ...OLD, path: `/urun/${"a".repeat(81)}` },
          "seo.path_invalid",
        ],
        ["a region-qualified locale", { ...OLD, locale: "tr-TR" }, "seo.locale_invalid"],
      ])("refuses %s", async (_label, key, reason) => {
        expect(await reasonOf(service.claimPath({ ...key, ...PRODUCT }))).toBe(reason)
      })

      it("refuses an invalid owner", async () => {
        const claim = (owner: { entity_type: string; entity_id: string }) =>
          reasonOf(service.claimPath({ ...OLD, ...owner }))

        expect(await claim({ entity_type: "Product", entity_id: "p" })).toBe(
          "seo.entity_type_invalid"
        )
        expect(await claim({ entity_type: "a".repeat(65), entity_id: "p" })).toBe(
          "seo.entity_type_invalid"
        )
        expect(await claim({ entity_type: "product", entity_id: "" })).toBe("seo.entity_id_invalid")
      })

      it("matches Medusa's duplicate text, which the race handling reads", async () => {
        await service.createUrlEntries({ ...OLD, ...PRODUCT })
        let violation: unknown
        try {
          await service.createUrlEntries({ ...OLD, ...OTHER })
        } catch (error) {
          violation = error
        }

        expect(uniqueViolationKeys(violation)).toEqual(["locale", "path"])
      })
    })

    describe("unclaimPath", () => {
      it("frees a new path and restores the record's earlier one", async () => {
        await service.claimPath({ ...OLD, ...PRODUCT })
        const claim = await service.claimPath({ ...NEW, ...PRODUCT })

        await service.unclaimPath(claim)

        expect(await service.resolvePath(NEW)).toBeNull()
        expect(await service.resolvePath(OLD)).toMatchObject({ status: "active" })
        await expect(service.claimPath({ ...NEW, ...OTHER })).resolves.toBeDefined()
      })

      it("puts a reactivated path back to reserved", async () => {
        await service.claimPath({ ...OLD, ...PRODUCT })
        await service.releasePath({ ...OLD, ...PRODUCT })
        const claim = await service.claimPath({ ...OLD, ...PRODUCT })

        await service.unclaimPath(claim)

        expect(await service.resolvePath(OLD)).toMatchObject({ status: "reserved" })
      })
    })

    describe("releasePath", () => {
      it("reserves an active path and reports what it was", async () => {
        await service.claimPath({ ...OLD, ...PRODUCT })

        expect(await service.releasePath({ ...OLD, ...PRODUCT })).toBe("active")
        expect(await service.releasePath({ ...OLD, ...PRODUCT })).toBe("reserved")
        expect(await service.resolvePath(OLD)).toMatchObject({ status: "reserved" })
      })

      it("refuses another record's path and ignores a free one", async () => {
        await service.claimPath({ ...OLD, ...PRODUCT })

        expect(await reasonOf(service.releasePath({ ...OLD, ...OTHER }))).toBe("seo.path_not_owned")
        expect(await service.releasePath({ ...NEW, ...PRODUCT })).toBe("none")
      })

      it("reserves every active path of a record", async () => {
        await service.claimPath({ ...OLD, ...PRODUCT })
        await service.claimPath({ ...OLD, locale: "en", ...PRODUCT })

        const released = await service.releasePathsOf(PRODUCT)

        expect(released).toHaveLength(2)
        expect(await service.resolvePath(OLD)).toMatchObject({ status: "reserved" })
      })
    })

    describe("freePath", () => {
      it("gives a reserved path up so another record can claim it", async () => {
        await service.claimPath({ ...OLD, ...PRODUCT })
        await service.releasePath({ ...OLD, ...PRODUCT })

        expect(await service.freePath({ ...OLD, ...PRODUCT })).toBe(true)
        expect(await service.resolvePath(OLD)).toBeNull()
        await expect(service.claimPath({ ...OLD, ...OTHER })).resolves.toBeDefined()
      })

      it("refuses another record's path and reports a free one", async () => {
        await service.claimPath({ ...OLD, ...PRODUCT })

        expect(await reasonOf(service.freePath({ ...OLD, ...OTHER }))).toBe("seo.path_not_owned")
        expect(await service.freePath({ ...NEW, ...PRODUCT })).toBe(false)
      })
    })

    describe("resolvePath", () => {
      it("answers null for an unknown or invalid path", async () => {
        expect(await service.resolvePath({ locale: "tr", path: "/yok" })).toBeNull()
        expect(await service.resolvePath({ locale: "tr", path: "not a path" })).toBeNull()
      })
    })
  },
})
