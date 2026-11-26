import { rgb } from "pdf-lib"
import type { PDFFont, PDFPage } from "pdf-lib"
import { MM, printable } from "../../pdf"

/** The label's margin and its one ink. */
export const MARGIN = 5 * MM
export const BLACK = rgb(0, 0, 0)

/** Writes top-down on the page: `y` is the distance from the top edge. */
export class Pen {
  y = MARGIN

  constructor(
    private readonly page: PDFPage,
    private readonly width: number,
    private readonly height: number
  ) {}

  text(value: string, font: PDFFont, size: number, options: { x?: number; center?: boolean } = {}) {
    const text = printable(font, value)
    const width = font.widthOfTextAtSize(text, size)
    const x = options.center ? (this.width - width) / 2 : (options.x ?? MARGIN)
    this.page.drawText(text, { x, y: this.height - this.y - size, size, font, color: BLACK })
    return width
  }

  line(thickness: number) {
    this.page.drawLine({
      start: { x: MARGIN, y: this.height - this.y },
      end: { x: this.width - MARGIN, y: this.height - this.y },
      thickness,
      color: BLACK,
    })
  }

  gap(points: number) {
    this.y += points
  }
}
