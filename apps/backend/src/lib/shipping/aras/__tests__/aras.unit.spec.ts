import { createServer } from "node:http"
import type { AddressInfo, Server } from "node:net"
import {
  arasCredentialsOf,
  arasOrderFields,
  arasStatusOf,
  createArasApi,
  isArasServiceUrl,
} from ".."
import type { ArasCredentials } from ".."
import { xmlElement } from "../../../clients/xml"
import { localPhone, receiverOf } from "../../receiver"

const credentials: ArasCredentials = {
  username: "magaza",
  password: "gizli-sifre",
  customerCode: "123456",
  testMode: true,
  serviceUrl: null,
}

const address = {
  first_name: "Ayşe",
  last_name: "Yılmaz",
  phone: "+905321234567",
  address_1: "Atatürk Cad. No: 5",
  address_2: "Moda Mah.",
  city: "Kadıköy",
  province: "İstanbul",
  postal_code: "34710",
  country_code: "tr",
}

describe("Aras (adr/0035)", () => {
  it("reads the panel's account: both secrets needed, the rest in the clear", () => {
    expect(
      arasCredentialsOf({
        settings: { test_mode: false, customer_code: " 123 ", service_url: "" },
        secrets: { username: "u", password: "p" },
      })
    ).toEqual({
      username: "u",
      password: "p",
      customerCode: "123",
      testMode: false,
      serviceUrl: null,
    })
    expect(arasCredentialsOf({ settings: {}, secrets: { username: "u" } })).toBeNull()
  })

  it("takes a service address on Aras's own hosts only", () => {
    expect(isArasServiceUrl("https://customerws.araskargo.com.tr")).toBe(true)
    expect(isArasServiceUrl("http://customerws.araskargo.com.tr")).toBe(false)
    expect(isArasServiceUrl("https://customerws.araskargo.com.tr:8443")).toBe(false)
    expect(isArasServiceUrl("https://customerws.araskargo.com.tr:443/x")).toBe(true)
    // A stored address no longer Aras's is not used at all
    expect(
      arasCredentialsOf({
        settings: { service_url: "https://evil.example" },
        secrets: { username: "u", password: "p" },
      })
    ).toBeNull()
    expect(isArasServiceUrl("https://araskargo.com.tr.evil.example")).toBe(false)
    expect(isArasServiceUrl("https://user:pw@customerws.araskargo.com.tr")).toBe(false)
  })

  it("writes the receiver as Medusa keeps a Turkish address, the phone as a courier dials it", () => {
    expect(receiverOf(address)).toEqual({
      name: "Ayşe Yılmaz",
      address: "Moda Mah., Atatürk Cad. No: 5",
      quarter: "Moda Mah.",
      town: "Kadıköy",
      city: "İstanbul",
      phone: "05321234567",
    })
    expect(localPhone("0532 123 45 67")).toBe("05321234567")
    expect(localPhone("123")).toBe("")
    expect(() => receiverOf({ ...address, phone: "" })).toThrow("phone")
    expect(() => receiverOf({ ...address, country_code: "de" })).toThrow("country_code")
  })

  it("asks the courier to collect at the door only when the order is paid there", () => {
    const order = (cashOnDelivery: number | null) =>
      arasOrderFields(credentials, {
        integrationCode: "QT01ABCDEF",
        waybill: "1042",
        receiver: receiverOf(address),
        desi: 1.5,
        kg: 0.45,
        cashOnDelivery,
        description: "Sipariş 1042",
      })
    expect(order(24_990)).toMatchObject({ IsCod: "1", CodAmount: "249.90", PieceCount: "1" })
    expect(order(null)).toMatchObject({ IsCod: "0", CodAmount: "0", CodCollectionType: null })
    expect(order(null)["PieceDetails"]).toEqual({
      PieceDetail: [
        {
          VolumetricWeight: "1.50",
          Weight: "0.45",
          BarcodeNumber: "QT01ABCDEF",
          Description: "Sipariş 1042",
        },
      ],
    })
  })

  it("reads where the parcel stands from the words Aras shows, failed before delivered", () => {
    expect(arasStatusOf([])).toMatchObject({ status: "created", tracking_number: null })
    expect(arasStatusOf([{ KARGO_TAKIP_NO: "1234567890", DURUMU: "Dağıtımda" }])).toMatchObject({
      status: "out_for_delivery",
      tracking_number: "1234567890",
      tracking_url: expect.stringContaining("code=1234567890") as string,
    })
    expect(arasStatusOf([{ DURUMU: "Teslim Edildi" }]).status).toBe("delivered")
    expect(arasStatusOf([{ DURUMU: "Teslim Edilemedi" }]).status).toBe("failed")
    expect(arasStatusOf([{ DURUMU: "Göndericiye İade" }]).status).toBe("returned")
    // What the shopper typed is not Aras's word on the parcel
    expect(
      arasStatusOf([{ ALICI: "Teslim Edildi", ADRES: "Dağıtım Sok.", DURUMU: "Yolda" }]).status
    ).toBe("in_transit")
  })
})

describe("Aras client (adr/0035)", () => {
  let server: Server
  let answer = ""
  const bodies: string[] = []
  const actions: string[] = []

  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = ""
      req.on("data", (chunk: Buffer) => (body += chunk.toString()))
      req.on("end", () => {
        bodies.push(body)
        actions.push(String(req.headers["soapaction"]))
        res.writeHead(200, { "content-type": "text/xml" }).end(answer)
      })
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  })

  afterAll(async () => {
    await new Promise<void>((resolve) =>
      server.close(() => {
        resolve()
      })
    )
  })

  const api = () =>
    createArasApi({
      baseUrl: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`,
    })
  const envelope = (body: string) =>
    `<?xml version="1.0"?><soap:Envelope xmlns:soap="x"><soap:Body>${body}</soap:Body></soap:Envelope>`

  it("sends an order with the shop's account and refuses a non-zero result", async () => {
    answer = envelope(
      xmlElement("SetOrderResponse", {
        SetOrderResult: { OrderResultInfo: { ResultCode: "0", ResultMessage: "OK" } },
      })
    )
    const input = {
      integrationCode: "QT01ABCDEF",
      waybill: "1042",
      receiver: receiverOf(address),
      desi: 1,
      kg: 1,
      cashOnDelivery: null,
      description: "Sipariş 1042",
    }

    await api().setOrder(credentials, input)
    answer = envelope(
      xmlElement("SetOrderResponse", {
        SetOrderResult: { OrderResultInfo: { ResultCode: "936", ResultMessage: "Hata" } },
      })
    )
    const refused = await api()
      .setOrder(credentials, input)
      .catch((error: unknown) => error)

    expect(actions[0]).toBe('"http://tempuri.org/SetOrder"')
    expect(bodies[0]).toContain("<IntegrationCode>QT01ABCDEF</IntegrationCode>")
    expect(bodies[0]).toContain("<userName>magaza</userName>")
    expect(refused).toMatchObject({ providerCode: "error_936" })
  })

  it("reads the label's PDF and the tracking rows of a DataSet answer", async () => {
    answer = envelope(
      xmlElement("GetArasBarcodeResponse", {
        GetArasBarcodeResult: { ResultCode: "0", ZebraPdf: { string: ["JVBERi0x"] } },
      })
    )
    const pdf = await api().label(credentials, "QT01ABCDEF")
    answer = envelope(
      `<GetCargoInfoResponse><GetCargoInfoResult><xs:schema xmlns:xs="s"/>` +
        `<diffgr:diffgram xmlns:diffgr="d"><DocumentElement>` +
        `<IrsDataDataTable><KARGO_TAKIP_NO>1234567890</KARGO_TAKIP_NO><DURUMU>YOLDA</DURUMU></IrsDataDataTable>` +
        `</DocumentElement></diffgr:diffgram></GetCargoInfoResult></GetCargoInfoResponse>`
    )
    const rows = await api().cargoInfo(credentials, "QT01ABCDEF")

    expect(pdf).toBe("JVBERi0x")
    expect(rows).toEqual([{ KARGO_TAKIP_NO: "1234567890", DURUMU: "YOLDA" }])
  })
})
