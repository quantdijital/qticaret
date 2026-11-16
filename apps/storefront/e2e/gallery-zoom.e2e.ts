import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { stockedProduct } from "./catalog"
import { dismissCookies } from "./support"

/**
 * The product gallery's full-screen picture in a real browser (owner
 * 2026-11-16: a press beside the photo zoomed in; jsdom draws nothing, so
 * the geometry is the browser's here): a press on the photo's own pixels
 * enlarges it, a press on the graphite around it closes, enlarged or not,
 * the focus back on "Görseli büyüt"; a drag does neither. On a wide screen
 * with the mouse and on a phone with touch.
 */

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** The photo as drawn (its natural size fitted and centred in the picture's box) and the area. */
const photoOf = (page: Page) =>
  page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>("[role=dialog] .gf-zoom img")
    const frame = img?.closest(".gf-zoom")?.parentElement
    if (!img || !frame) {
      throw new Error("no zoom picture")
    }
    const box = img.getBoundingClientRect()
    const fit = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight)
    const width = img.naturalWidth * fit
    const height = img.naturalHeight * fit
    const left = box.left + (box.width - width) / 2
    const top = box.top + (box.height - height) / 2
    const area = frame.getBoundingClientRect()
    return {
      photo: { left, top, right: left + width, bottom: top + height },
      area: { left: area.left, top: area.top, right: area.right, bottom: area.bottom },
    }
  })

/** A point on the graphite inside the area, clear of the photo and of the arrows (mid-height). */
function graphite(photo: Box, area: Box): { x: number; y: number } {
  if (photo.left - area.left >= 24) {
    return { x: (area.left + photo.left) / 2, y: area.top + 16 }
  }
  if (photo.top - area.top >= 24) {
    return { x: (area.left + area.right) / 2, y: (area.top + photo.top) / 2 }
  }
  // A photo that fills its area: the bar above it, clear of the count and the close button
  return { x: (area.left + area.right) / 2, y: area.top / 2 }
}

const dialog = (page: Page) => page.getByRole("dialog")
const zoomed = (page: Page) =>
  page.evaluate(() => Boolean(document.querySelector("[role=dialog] .gf-zoom[data-zoomed]")))

async function openZoom(page: Page) {
  await page.getByRole("button", { name: "Görseli büyüt" }).click()
  await expect(dialog(page)).toBeVisible()
  await page.waitForFunction(() => {
    const img = document.querySelector<HTMLImageElement>("[role=dialog] .gf-zoom img")
    return Boolean(img?.complete && img.naturalWidth > 0)
  })
  return photoOf(page)
}

async function press(page: Page, x: number, y: number, touch: boolean) {
  if (touch) {
    await page.touchscreen.tap(x, y)
  } else {
    await page.mouse.click(x, y)
  }
}

for (const screen of [
  {
    name: "a wide screen, the mouse",
    touch: false,
    use: { viewport: { width: 1440, height: 900 } },
  },
  {
    name: "a phone, touch",
    touch: true,
    use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  },
]) {
  test.describe(`the gallery's zoom on ${screen.name}`, () => {
    test.use(screen.use)

    test.beforeEach(async ({ page }) => {
      await page.goto((await stockedProduct()).path)
      await dismissCookies(page)
    })

    test("centres the photo and enlarges it where the photo itself is pressed", async ({
      page,
    }) => {
      const { photo } = await openZoom(page)
      const viewport = page.viewportSize() ?? { width: 0, height: 0 }
      expect(Math.abs((photo.left + photo.right) / 2 - viewport.width / 2)).toBeLessThan(2)
      expect(Math.abs((photo.top + photo.bottom) / 2 - viewport.height / 2)).toBeLessThan(2)
      await press(
        page,
        (photo.left + photo.right) / 2,
        (photo.top + photo.bottom) / 2,
        screen.touch
      )
      await expect.poll(() => zoomed(page)).toBe(true)
      await expect(dialog(page)).toBeVisible()
    })

    test("closes on the graphite around the photo, the focus back on the enlarge button", async ({
      page,
    }) => {
      const { photo, area } = await openZoom(page)
      const point = graphite(photo, area)
      await press(page, point.x, point.y, screen.touch)
      await expect(dialog(page)).toBeHidden()
      await expect(page.getByRole("button", { name: "Görseli büyüt" })).toBeFocused()
      // Nothing fell through to the page: the zoom stays closed
      await page.waitForTimeout(300)
      await expect(dialog(page)).toBeHidden()
    })

    test("closes when enlarged too, once the pointer is on the graphite", async ({ page }) => {
      const { photo } = await openZoom(page)
      const middle = { x: (photo.left + photo.right) / 2, y: (photo.top + photo.bottom) / 2 }
      await press(page, middle.x, middle.y, screen.touch)
      await expect.poll(() => zoomed(page)).toBe(true)
      // The enlarged photo follows the pointer: at the area's corner its own edge shows there
      const { area } = await photoOf(page)
      const corner = { x: area.left + 4, y: area.top + 4 }
      if (!screen.touch) {
        await page.mouse.move(corner.x, corner.y, { steps: 8 })
      }
      const now = await photoOf(page)
      const onGraphite =
        corner.x < now.photo.left ||
        corner.x > now.photo.right ||
        corner.y < now.photo.top ||
        corner.y > now.photo.bottom
      test.skip(!onGraphite, "the enlarged photo covers the whole area here")
      await press(page, corner.x, corner.y, screen.touch)
      await expect(dialog(page)).toBeHidden()
    })

    test("neither closes nor lets go when the enlarged photo is dragged", async ({ page }) => {
      test.skip(screen.touch, "a touch drag is the browser's pan, never a click")
      const { photo } = await openZoom(page)
      const middle = { x: (photo.left + photo.right) / 2, y: (photo.top + photo.bottom) / 2 }
      await page.mouse.click(middle.x, middle.y)
      await expect.poll(() => zoomed(page)).toBe(true)
      await page.mouse.move(middle.x, middle.y)
      await page.mouse.down()
      await page.mouse.move(middle.x - 120, middle.y - 40, { steps: 6 })
      await page.mouse.up()
      await expect(dialog(page)).toBeVisible()
      expect(await zoomed(page)).toBe(true)
    })
  })
}
