import { measureGrowth } from "@qticaret/testing"
import { XmlRefused, escapeXml, findAll, parseXml, soapEnvelope, textOf, xmlElement } from "../xml"

describe("xml (adr/0035)", () => {
  it("escapes every value and drops characters XML does not allow", () => {
    expect(escapeXml(`<a href="x">Tom & 'Jerry'\u0001</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;"
    )
  })

  it("writes lists as repeated elements, objects nested, nothing for null", () => {
    expect(
      xmlElement("Order", {
        ReceiverName: "Ayşe <Yılmaz>",
        PieceCount: 2,
        Missing: null,
        PieceDetails: { PieceDetail: [{ Weight: "1" }, { Weight: "2" }] },
      })
    ).toBe(
      "<Order><ReceiverName>Ayşe &lt;Yılmaz&gt;</ReceiverName><PieceCount>2</PieceCount>" +
        "<PieceDetails><PieceDetail><Weight>1</Weight></PieceDetail>" +
        "<PieceDetail><Weight>2</Weight></PieceDetail></PieceDetails></Order>"
    )
    expect(() => xmlElement("bad name", "x")).toThrow(XmlRefused)
  })

  it("puts the parameters in the operation's namespace, or the operation alone prefixed", () => {
    const asmx = soapEnvelope({
      namespace: "http://tempuri.org/",
      operation: "CancelDispatch",
      params: { userName: "u", integrationCode: "QT1" },
    })
    const jaxws = soapEnvelope({
      namespace: "http://yurticikargo.com.tr/ShippingOrderDispatcherServices",
      operation: "cancelShipment",
      params: { cargoKeys: "QT1" },
      prefixed: true,
    })
    expect(asmx).toContain('<CancelDispatch xmlns="http://tempuri.org/"><userName>u</userName>')
    expect(jaxws).toContain(
      '<op:cancelShipment xmlns:op="http://yurticikargo.com.tr/ShippingOrderDispatcherServices"><cargoKeys>QT1</cargoKeys></op:cancelShipment>'
    )
  })

  it("writes SOAP 1.2 with fields qualified by another namespace (Axis2)", () => {
    const axis2 = soapEnvelope({
      namespace: "http://takip.ptt.gov.tr",
      operation: "gonderiSorgu2",
      params: { "op:input": { "ax:barkod": "1" } },
      prefixed: true,
      namespaces: { ax: "http://takip.ptt.gov.tr/xsd" },
      version: "1.2",
    })
    expect(axis2).toContain('xmlns:soap="http://www.w3.org/2003/05/soap-envelope"')
    expect(axis2).toContain(
      '<op:gonderiSorgu2 xmlns:op="http://takip.ptt.gov.tr" xmlns:ax="http://takip.ptt.gov.tr/xsd"><op:input><ax:barkod>1</ax:barkod></op:input>'
    )
    expect(() =>
      soapEnvelope({ namespace: "x", operation: "o", params: {}, namespaces: { "a b": "y" } })
    ).toThrow(XmlRefused)
  })

  it("reads an answer: prefixes off, entities and CDATA in, attributes kept", () => {
    const tree = parseXml(
      `<?xml version="1.0"?><soap:Envelope xmlns:soap="x"><soap:Body>` +
        `<!-- note --><R><ResultCode>0</ResultCode><Msg>Tom &amp; &#x4A;erry</Msg>` +
        `<Data><![CDATA[<raw>]]></Data><Empty/><Item id="1">a</Item><Item id='2'>b</Item>` +
        `</R></soap:Body></soap:Envelope>`
    )
    expect(textOf(tree, "ResultCode")).toBe("0")
    expect(textOf(tree, "Msg")).toBe("Tom & Jerry")
    expect(textOf(tree, "Data")).toBe("<raw>")
    expect(textOf(tree, "Empty")).toBeNull()
    expect(textOf(tree, "Absent")).toBeNull()
    expect(findAll(tree, "Item").map((item) => [item.attributes["id"], item.text])).toEqual([
      ["1", "a"],
      ["2", "b"],
    ])
  })

  it("refuses a DOCTYPE, an unknown entity, broken nesting and runaway depth", () => {
    const refused = (source: string) => () => parseXml(source)
    expect(refused(`<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><a>&e;</a>`)).toThrow(
      XmlRefused
    )
    expect(refused("<a>&nbsp;</a>")).toThrow(XmlRefused)
    expect(refused("<a><b></a></b>")).toThrow(XmlRefused)
    expect(refused("<a><b>")).toThrow(XmlRefused)
    expect(refused("<x>".repeat(70) + "</x>".repeat(70))).toThrow(XmlRefused)
  })

  it("refuses a character no text can hold and a tag no answer has, quickly", () => {
    const refused = (source: string) => () => parseXml(source)
    expect(refused("<a>&#x110000;</a>")).toThrow(XmlRefused)
    expect(refused("<a>&#xD800;</a>")).toThrow(XmlRefused)
    // Quickly: by how the time grows with the input (8× the input: ~8× when
    // linear, ~64× when quadratic), not a wall-clock budget (adr/0081)
    const growth = measureGrowth(
      (n) => {
        const source = `<a ${"b".repeat(n)}></a>`
        return () => {
          expect(refused(source)).toThrow(XmlRefused)
        }
      },
      625_000,
      { rounds: 3 }
    )
    expect(growth).toMatchObject({ linear: true })
  })
})
