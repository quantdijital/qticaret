import {
  CREATED_PHRASES,
  DELETED_PHRASES,
  phraseOf,
  saysDone,
  suratCredentialsOf,
  suratDesi,
  suratShipmentFields,
  suratStatusOf,
  suratTrackingOf,
  suratTrackingUrl,
  trackingRefusal,
} from ".."
import { isProviderError } from "../../../errors"
import { receiverOf } from "../../receiver"

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

const refusal = (run: () => unknown) => {
  try {
    run()
  } catch (error) {
    return isProviderError(error) ? error : null
  }
  return null
}

describe("Sürat's free-text answers (docs/entegrasyonlar/surat.md)", () => {
  it("counts only a known sentence as done, whatever its case or end punctuation", () => {
    expect(saysDone("Tamam", CREATED_PHRASES)).toBe(true)
    expect(saysDone("  TAMAM. ", CREATED_PHRASES)).toBe(true)
    expect(saysDone("İşlem Başarılı!", CREATED_PHRASES)).toBe(true)
    expect(saysDone("Gönderi silindi.", DELETED_PHRASES)).toBe(true)
    // Words alone are no success: an unknown sentence may say anything
    expect(saysDone("Tamam değil: alıcı adresi eksik", CREATED_PHRASES)).toBe(false)
    expect(saysDone("İşlem başarısız", CREATED_PHRASES)).toBe(false)
    expect(saysDone("silindi", CREATED_PHRASES)).toBe(false)
    expect(saysDone("", CREATED_PHRASES)).toBe(false)
    expect(saysDone(null, CREATED_PHRASES)).toBe(false)
    expect(phraseOf("  Kayıt   Silindi. ")).toBe("kayıt silindi")
  })

  it("tells a refused login from an unknown code in a tracking refusal", () => {
    expect(trackingRefusal("Cari kodu veya şifre hatalı.")).toBe("login")
    expect(trackingRefusal("CARİ KODU BULUNAMADI")).toBe("login")
    expect(trackingRefusal("Kayıt bulunamadı")).toBe("not_found")
    expect(trackingRefusal("Sistem hatası")).toBe("other")
  })
})

describe("suratCredentialsOf", () => {
  it("tracks with the cari pair when both parts are stored, else with the shipping login", () => {
    const secrets = { username: "ws-user", password: "ws-pass" }
    expect(suratCredentialsOf({ settings: {}, secrets })?.tracking).toEqual({
      username: "ws-user",
      password: "ws-pass",
    })
    expect(
      suratCredentialsOf({
        settings: {},
        secrets: { ...secrets, cari_code: "1234567", web_password: "web-pass" },
      })?.tracking
    ).toEqual({ username: "1234567", password: "web-pass" })
    expect(suratCredentialsOf({ settings: {}, secrets: { username: "ws-user" } })).toBeNull()
  })
})

describe("suratShipmentFields", () => {
  const input = {
    code: "QTABCDEFGHJKLMNP",
    orderNumber: "1042",
    receiver: receiverOf(address),
    desi: 0.4,
    kg: 0.45,
    cashOnDelivery: null,
  }

  it("sends our code, the receiver split as Sürat keeps it, and no e-mail", () => {
    const fields = suratShipmentFields(input)

    expect(fields).toMatchObject({
      KisiKurum: "Ayşe Yılmaz",
      Il: "İstanbul",
      Ilce: "Kadıköy",
      TelefonCep: "5321234567",
      Email: "",
      OzelKargoTakipNo: "QTABCDEFGHJKLMNP",
      ReferansNo: "QTABCDEFGHJKLMNP",
      IrsaliyeSiraNo: "1042",
      Adet: 1,
      BirimDesi: "0.40",
      BirimKg: "0.45",
      KapidanOdemeTahsilatTipi: 0,
      KapidanOdemeTutari: "0",
      Iademi: false,
    })
    const street = fields["AliciAdresi"]
    expect(typeof street === "string" && street.includes("Moda Mah.")).toBe(true)
  })

  it("asks the courier to collect cash at the door, the amount with a dot", () => {
    expect(suratShipmentFields({ ...input, cashOnDelivery: 125_990 })).toMatchObject({
      KapidanOdemeTahsilatTipi: 1,
      KapidanOdemeTutari: "1259.90",
    })
  })

  it("leaves desi and kg empty for an unmeasured parcel: the branch measures", () => {
    expect(suratShipmentFields({ ...input, desi: null, kg: null })).toMatchObject({
      BirimDesi: "",
      BirimKg: "",
    })
    expect(suratDesi({ length_cm: 35, width_cm: 8, height_cm: 4 })).toBe(0.38)
  })
})

describe("suratTrackingOf", () => {
  it("reads an empty answer as a code Sürat does not know yet", () => {
    expect(suratTrackingOf("")).toEqual({ found: false, rows: [] })
    expect(suratTrackingOf(null)).toEqual({ found: false, rows: [] })
    expect(suratTrackingOf('{"IsError":false,"Gonderiler":[]}')).toEqual({
      found: false,
      rows: [],
    })
  })

  it("reads the JSON's movements, each carrying its parcel's columns", () => {
    const tracking = suratTrackingOf(
      JSON.stringify({
        IsError: false,
        Gonderiler: [
          {
            KargoTakipNo: "123456789012",
            Hareketler: [
              { HareketTipi: "KargoSubedeTeslimAlindi", IslemTarihi: "26.11.2026 10:00" },
              { HareketTipi: "KargoDagitimaCikti", IslemTarihi: "27.11.2026 09:00" },
            ],
          },
        ],
      })
    )

    expect(tracking.found).toBe(true)
    expect(tracking.rows).toEqual([
      {
        KARGOTAKIPNO: "123456789012",
        HAREKETTIPI: "KargoSubedeTeslimAlindi",
        ISLEMTARIHI: "26.11.2026 10:00",
      },
      {
        KARGOTAKIPNO: "123456789012",
        HAREKETTIPI: "KargoDagitimaCikti",
        ISLEMTARIHI: "27.11.2026 09:00",
      },
    ])
  })

  it("names a refused login apart, the account's values masked in Sürat's sentence", () => {
    const error = refusal(() =>
      suratTrackingOf('{"IsError":true,"errorMessage":"Cari 1234567 için şifre hatalı"}', [
        "1234567",
      ])
    )

    expect(error?.providerCode).toBe("login_refused")
    expect(error?.providerMessage).not.toContain("1234567")
    expect(suratTrackingOf('{"IsError":true,"errorMessage":"Kayıt bulunamadı"}').found).toBe(false)
    expect(
      refusal(() => suratTrackingOf('{"IsError":true,"errorMessage":"Bakım"}'))?.providerCode
    ).toBe("rejected")
  })

  it("reads an XML DataSet's rows, and refuses one carrying a DOCTYPE (XXE)", () => {
    const tracking = suratTrackingOf(
      "<NewDataSet><Table><KARGO_TAKIP_NO>123456789012</KARGO_TAKIP_NO><HAREKET_ACIKLAMA>Kargo teslim edildi</HAREKET_ACIKLAMA></Table></NewDataSet>"
    )
    const evil = refusal(() =>
      suratTrackingOf(
        '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><NewDataSet><Table><A>&e;</A></Table></NewDataSet>'
      )
    )

    expect(tracking.rows).toEqual([
      { KARGOTAKIPNO: "123456789012", HAREKETACIKLAMA: "Kargo teslim edildi" },
    ])
    expect(evil?.providerCode).toBe("invalid_response")
  })

  it("refuses JSON it cannot read", () => {
    expect(refusal(() => suratTrackingOf("{not json"))?.providerCode).toBe("invalid_response")
  })
})

describe("suratStatusOf", () => {
  const status = (rows: Record<string, string>[]) => suratStatusOf({ found: true, rows })

  it("maps Sürat's event names, the latest movement that says something winning", () => {
    expect(
      status([
        { HAREKETTIPI: "KargoSubedeTeslimAlindi", KARGOTAKIPNO: "123456789012" },
        { HAREKETTIPI: "AracYolaCikti" },
        { HAREKETTIPI: "KargoDagitimaCikti" },
        // A new barcode says nothing about where the parcel is
        { HAREKETTIPI: "KargoYeniBarkodUretildi" },
      ])
    ).toEqual({
      status: "out_for_delivery",
      provider_status: "KargoDagitimaCikti",
      tracking_number: "123456789012",
      tracking_url: suratTrackingUrl("123456789012"),
    })
    expect(status([{ HAREKETTIPI: "KargoAdresteTeslimEdildi" }]).status).toBe("delivered")
    expect(status([{ HAREKETTIPI: "KargoIadeOnay" }]).status).toBe("returned")
    expect(status([{ TESLIMATDURUM: "IptalEdildi" }]).status).toBe("canceled")
    // A return asked for, not yet agreed: the parcel goes on as before
    expect(
      status([{ HAREKETTIPI: "KargoDagitimaCikti" }, { HAREKETTIPI: "KargoIadeTalep" }]).status
    ).toBe("out_for_delivery")
  })

  it("falls back on the words, a failed delivery staying on its way", () => {
    expect(status([{ ACIKLAMA: "Kargo şubede teslim alındı" }]).status).toBe("picked_up")
    expect(status([{ ACIKLAMA: "Alıcı adreste yok, teslim edilemedi" }]).status).toBe("in_transit")
    expect(status([{ ACIKLAMA: "TESLİM EDİLDİ" }]).status).toBe("delivered")
    expect(status([{ ACIKLAMA: "Kargo dağıtıma çıktı" }]).status).toBe("out_for_delivery")
  })

  it("reads only Sürat's own columns: a receiver named 'Teslim' moves nothing", () => {
    expect(
      status([{ ALICIADI: "Teslim Edildi Yılmaz", ALICIADRESI: "İade Sokak", ACIKLAMA: "Kayıt" }])
        .status
    ).toBe("created")
  })

  it("orders the movements by their times when Sürat lists the newest first", () => {
    expect(
      status([
        { HAREKETTIPI: "KargoAdresteTeslimEdildi", ISLEMTARIHI: "28.11.2026 15:00" },
        { HAREKETTIPI: "KargoSubedeTeslimAlindi", ISLEMTARIHI: "26.11.2026 10:00" },
      ]).status
    ).toBe("delivered")
  })

  it("is created while Sürat does not know the parcel; links the fake's page on a developer's machine", () => {
    expect(suratStatusOf({ found: false, rows: [] })).toEqual({
      status: "created",
      provider_status: null,
      tracking_number: null,
      tracking_url: null,
    })
    expect(suratTrackingUrl("123456789012")).toBe(
      "https://suratkargo.com.tr/KargoTakip/?kargotakipno=123456789012"
    )
    expect(suratTrackingUrl("123456789012", "http://127.0.0.1:9111")).toBe(
      "http://127.0.0.1:9111/takip/123456789012"
    )
  })
})
