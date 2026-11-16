import { SVG_MAX_BYTES, looksLikeSvg } from "../svg"
import { SvgRefusal, cleanSvg } from "../svg-clean"
import { prescan } from "../svg-scan"

// The cleaner itself, as the worker runs it (svg-worker.unit.spec.ts covers the worker)
const sanitizeSvg = (bytes: Buffer) => cleanSvg(bytes, SVG_MAX_BYTES)

const svg = (body: string, attrs = 'viewBox="0 0 120 40"') =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`)

const clean = (input: string | Buffer) =>
  sanitizeSvg(typeof input === "string" ? Buffer.from(input) : input).buffer.toString("utf8")

function refusal(input: Buffer): string | null {
  try {
    sanitizeSvg(input)
    return null
  } catch (error) {
    return error instanceof SvgRefusal ? error.safeMessage : "thrown"
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
  })

  it.each([
    ["an escaped @import", "<style>@\\69mport 'https://x.example/y.css'; .a{fill:red}</style>"],
    ["an escaped url() in a style", '<rect style="fill:u\\72l(https://x.example/t)" width="1"/>'],
    ["a font face", "<style>@font-face{src:u\\72l(https://x.example/f.woff)}</style>"],
    ["an image set", "<style>.a{fill:image-set('https://x.example/t' 1x)}</style>"],
    ["an escaped url() in fill", '<rect fill="u\\72l(https://x.example/t)" width="1"/>'],
    ["an image set in fill", '<rect fill="image-set(\'https://x.example/t\' 1x)" width="1"/>'],
  ])("keeps no outside reference through %s", (_name, body) => {
    const out = clean(svg(`${body}<rect width="9" height="9"/>`))
    expect(out).not.toMatch(/x\.example|\\|@|image-set/)
    expect(out).toContain('<rect width="9" height="9"/>')
  })

  it("keeps an Illustrator logo's class colours, gradients and clip paths", () => {
    const illustrator = Buffer.from(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 200 60">\n' +
        "  <defs>\n" +
        "    <style>\n      .cls-1 {\n        fill: url(#linear-gradient);\n      }\n\n      .cls-2 {\n        fill: #1d1d1b;\n        stroke: #fff;\n        stroke-miterlimit: 10;\n      }\n\n      .cls-3 {\n        clip-path: url(#clippath);\n      }\n    </style>\n" +
        '    <clipPath id="clippath"><rect class="cls-2" x="0" y="0" width="60" height="60"/></clipPath>\n' +
        '    <linearGradient id="linear-gradient" x1="0" y1="30" x2="60" y2="30" gradientUnits="userSpaceOnUse">\n' +
        '      <stop offset="0" stop-color="#c8102e"/>\n      <stop offset="1" stop-color="#7a0019"/>\n' +
        "    </linearGradient>\n  </defs>\n" +
        '  <g class="cls-3"><circle class="cls-1" cx="30" cy="30" r="30"/></g>\n' +
        '  <path class="cls-2" d="M80,10h40v40h-40z"/>\n</svg>\n'
    )
    const out = clean(illustrator)
    // Cleaned again (as the library reads it back), the same file
    expect(clean(out)).toBe(out)
    for (const kept of [
      ".cls-1{fill:url(#linear-gradient)}",
      ".cls-2{fill:#1d1d1b;stroke:#fff;stroke-miterlimit:10}",
      // clip-path is no colour property: the sheet drops it, the attribute below keeps it
      'id="clippath"',
      'id="linear-gradient"',
      'stop-color="#c8102e"',
      'class="cls-1"',
      'd="M80,10h40v40h-40z"',
      'viewBox="0 0 200 60"',
    ]) {
      expect(out).toContain(kept)
    }
  })

  it("keeps a Figma logo's presentation attributes, gradients and clip paths", () => {
    const figma = Buffer.from(
      '<svg width="120" height="40" viewBox="0 0 120 40" fill="none" xmlns="http://www.w3.org/2000/svg">\n' +
        '<g clip-path="url(#clip0_1_2)">\n' +
        '<path d="M0 0H40V40H0V0Z" fill="url(#paint0_linear_1_2)"/>\n' +
        '<path d="M50 5H110V35H50V5Z" fill="#111827" fill-opacity="0.9" stroke="#F9FAFB" stroke-width="2"/>\n' +
        "</g>\n<defs>\n" +
        '<linearGradient id="paint0_linear_1_2" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">\n' +
        '<stop stop-color="#6366F1"/>\n<stop offset="1" stop-color="#EC4899"/>\n</linearGradient>\n' +
        '<clipPath id="clip0_1_2">\n<rect width="120" height="40" fill="white"/>\n</clipPath>\n' +
        "</defs>\n</svg>\n"
    )
    const out = clean(figma)
    expect(clean(out)).toBe(out)
    for (const kept of [
      'clip-path="url(#clip0_1_2)"',
      'fill="url(#paint0_linear_1_2)"',
      'fill-opacity="0.9"',
      'stroke="#F9FAFB"',
      'stop-color="#EC4899"',
      'id="clip0_1_2"',
      'width="120"',
    ]) {
      expect(out).toContain(kept)
    }
  })

  it("is the same once cleaned again (the library reads a stored SVG back)", () => {
    const once = sanitizeSvg(
      svg('<style>.a{fill:#000}</style><path class="a" d="M0 0h1v1z" fill="url(#g)"/>')
    ).buffer
    expect(sanitizeSvg(once).buffer.equals(once)).toBe(true)
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

  it.each([
    ["4,000 nested links", "<a>".repeat(4_000)],
    ["4,000 nested unknown elements", "<x>".repeat(4_000)],
    ["5,001 shallow elements", "<rect/>".repeat(5_001)],
    ["a tree too deep for a recursive walk", "<g>".repeat(4_900)],
  ])("refuses %s within a second, before DOMPurify reads it", (_name, body) => {
    // The text's read refuses it, with no clock; the second (a refusal takes
    // milliseconds, a parse of the nested trees 1.3 s and up) shows the
    // cleaner asks that read before it parses
    expect(prescan(svg(body).toString())).toBe("upload.svg_too_complex")
    const started = Date.now()
    expect(refusal(svg(body))).toBe("upload.svg_too_complex")
    expect(Date.now() - started).toBeLessThan(1_000)
  })

  it("tells an SVG by its content", () => {
    expect(looksLikeSvg(svg(""))).toBe(true)
    expect(looksLikeSvg(Buffer.from('﻿<?xml version="1.0"?>\n<!-- x -->\n<svg>'))).toBe(true)
    expect(looksLikeSvg(Buffer.from("<html><svg></svg></html>"))).toBe(false)
    expect(looksLikeSvg(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(false)
  })
})
