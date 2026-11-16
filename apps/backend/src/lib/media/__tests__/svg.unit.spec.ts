import { isValidationError } from "../../errors"
import { SVG_MAX_BYTES, cssReachesOut, looksLikeSvg, sanitizeSvg } from "../svg"

const svg = (body: string, attrs = 'viewBox="0 0 120 40"') =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`)

const clean = (input: string | Buffer) =>
  sanitizeSvg(typeof input === "string" ? Buffer.from(input) : input).buffer.toString("utf8")

function refusal(input: Buffer): string | null {
  try {
    sanitizeSvg(input)
    return null
  } catch (error) {
    return isValidationError(error) ? error.safeMessage : "thrown"
  }
}

describe("sanitizeSvg: a logo as it may be stored", () => {
  it("keeps a plain logo's look: viewBox, fills, paths, gradients, clip paths", () => {
    const logo = svg(
      '<defs><linearGradient id="g"><stop offset="0" stop-color="#123456"/></linearGradient>' +
        '<clipPath id="c"><rect width="10" height="10"/></clipPath></defs>' +
        '<path d="M0 0h10v10z" fill="url(#g)" clip-path="url(#c)"/>' +
        '<use href="#c"/><circle cx="5" cy="5" r="4" fill="#fff" style="opacity:.5"/>'
    )
    const out = clean(logo)
    // DOMPurify leaves `<use>` out of its SVG profile (its past bypasses): so do we
    expect(out).not.toContain("<use")
    for (const kept of [
      'viewBox="0 0 120 40"',
      "<linearGradient",
      'id="g"',
      'stop-color="#123456"',
      "<clipPath",
      'd="M0 0h10v10z"',
      'fill="url(#g)"',
      'clip-path="url(#c)"',
      'style="opacity:.5"',
      'xmlns="http://www.w3.org/2000/svg"',
    ]) {
      expect(out).toContain(kept)
    }
  })

  it("takes the size from the viewBox when the file names none, and stores it", () => {
    const result = sanitizeSvg(svg('<rect width="1" height="1"/>'))
    expect([result.width, result.height]).toEqual([120, 40])
    expect(result.buffer.toString()).toMatch(/width="120"/)
    expect(result.buffer.toString()).toMatch(/height="40"/)
    const sized = sanitizeSvg(svg("<rect/>", 'width="64" height="64" viewBox="0 0 10 10"'))
    expect([sized.width, sized.height]).toEqual([64, 64])
    const bare = sanitizeSvg(svg("<rect/>", ""))
    expect([bare.width, bare.height]).toEqual([512, 512])
  })

  it("drops scripts, handlers and foreign content", () => {
    const out = clean(
      svg(
        '<script>alert(1)</script><rect onload="alert(2)" onclick="x()" width="1"/>' +
          '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><img src=x onerror="alert(3)"/></div></foreignObject>' +
          '<iframe src="https://evil.example"/><embed src="x"/><object data="x"/>',
        'viewBox="0 0 1 1" onload="alert(4)"'
      )
    )
    expect(out).not.toMatch(
      /script|alert|onload|onclick|onerror|foreignObject|iframe|embed|object/i
    )
    expect(out).toContain("<rect")
  })

  it("keeps no reference out of the document: links, uses, images, javascript: and data:", () => {
    const out = clean(
      svg(
        '<a href="javascript:alert(1)"><path d="M0 0"/></a>' +
          '<use href="https://evil.example/s.svg#x"/><use xlink:href="data:image/svg+xml;base64,AAAA" xmlns:xlink="http://www.w3.org/1999/xlink"/>' +
          '<image href="data:image/png;base64,AAAA"/><image href="https://evil.example/t.png"/>' +
          '<animate attributeName="href" to="javascript:alert(1)"/><set attributeName="href" to="#x"/>'
      )
    )
    expect(out).not.toMatch(/javascript|evil\.example|data:|<image|<animate|<set|<a[\s>]/i)
    // The link's shape stays: it is only unwrapped
    expect(out).toContain('d="M0 0"')
  })

  it("drops CSS that reaches out: @import and url() to anything but #id", () => {
    const out = clean(
      svg(
        '<style>@import url("https://evil.example/x.css"); .a{fill:red}</style>' +
          "<style>.b{fill:url(#g)}</style>" +
          '<rect style="fill:url(https://evil.example/p.png)" width="1"/>' +
          '<rect fill="url(http://evil.example/#g)" width="2"/>'
      )
    )
    expect(out).not.toMatch(/evil\.example|@import/)
    expect(out).toContain(".b{fill:url(#g)}")
    expect(cssReachesOut("fill:url(#a);stroke:url('#b')")).toBe(false)
    expect(cssReachesOut("background:url(//evil.example/x)")).toBe(true)
    expect(cssReachesOut("fill:url(#a")).toBe(true)
    expect(cssReachesOut("width:expression(alert(1))")).toBe(true)
  })

  it("expands no entity: no XXE, no billion laughs", () => {
    const laughs = Buffer.from(
      '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "lol"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">' +
        '<!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;"><!ENTITY x SYSTEM "file:///etc/passwd">]>' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><text>&c;&x;</text></svg>'
    )
    expect(looksLikeSvg(laughs)).toBe(true)
    const started = Date.now()
    const out = clean(laughs)
    expect(Date.now() - started).toBeLessThan(2_000)
    expect(out).not.toMatch(/lollol|root:|DOCTYPE|ENTITY/)
  })

  it("refuses what is no single SVG, too large, too deep or too many elements", () => {
    expect(refusal(Buffer.from("<html><body>hi</body></html>"))).toBe("upload.svg_invalid")
    expect(refusal(Buffer.from("<svg"))).toBe("upload.svg_invalid")
    // All of it script or foreign content: nothing left to draw
    expect(refusal(svg("<script>alert(1)</script><foreignObject><p>x</p></foreignObject>"))).toBe(
      "upload.svg_invalid"
    )
    expect(refusal(Buffer.from([0xff, 0xfe, 0x00]))).toBe("upload.svg_invalid")
    expect(refusal(svg(`<rect/>${" ".repeat(SVG_MAX_BYTES)}`))).toBe("upload.svg_too_large")
    expect(refusal(svg(`${"<g>".repeat(100)}${"</g>".repeat(100)}`))).toBe("upload.svg_too_complex")
    expect(refusal(svg('<rect width="1"/>'.repeat(6_000)))).toBe("upload.svg_too_complex")
  })

  it("tells an SVG by its content", () => {
    expect(looksLikeSvg(svg(""))).toBe(true)
    expect(looksLikeSvg(Buffer.from('﻿<?xml version="1.0"?>\n<!-- x -->\n<svg>'))).toBe(true)
    expect(looksLikeSvg(Buffer.from("<html><svg></svg></html>"))).toBe(false)
    expect(looksLikeSvg(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(false)
  })
})
