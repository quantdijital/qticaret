import { sheetCustomers } from "../sources/customer-sheet"

const csv = (text: string) => Buffer.from(text, "utf8")

describe("an old platform's customer list (F14.3)", () => {
  it("reads a platform's own headers, splits a full name, keeps only dated consent", async () => {
    const customers = await sheetCustomers(
      csv(
        "E-Posta Adresi;Adı Soyadı;Cep Telefonu;İl;İlçe;Açık Adres;E-Posta İzni;SMS İzni;Üyelik Tarihi\n" +
          "Ayse@Example.com;Ayşe Nur Kaya;05321112233;İstanbul;Kadıköy;Bağdat Cd. 1;15.03.2024;Evet;01.02.2024\n" +
          "can@example.com;Can;;;;;;;\n" +
          ";Adressiz;;;;;;;\n" +
          "ayse@example.com;Ayşe Kaya;;;;;;;\n"
      )
    )
    expect(customers).toHaveLength(2)
    const [ayse, can] = customers
    // The last row for an address stands
    expect(ayse).toMatchObject({
      source_key: "ayse@example.com",
      first_name: "Ayşe",
      last_name: "Kaya",
    })
    expect(can).toMatchObject({
      first_name: "Can",
      last_name: null,
      addresses: [],
      marketing: null,
    })

    const [first] = await sheetCustomers(
      csv(
        "E-Posta Adresi;Adı Soyadı;Cep Telefonu;İl;İlçe;Açık Adres;E-Posta İzni;SMS İzni\n" +
          "ayse@example.com;Ayşe Nur Kaya;05321112233;İstanbul;Kadıköy;Bağdat Cd. 1;15.03.2024 10:30;Evet\n"
      )
    )
    expect(first).toMatchObject({
      first_name: "Ayşe Nur",
      last_name: "Kaya",
      phone: "05321112233",
      addresses: [{ address_1: "Bağdat Cd. 1", city: "Kadıköy", province: "İstanbul" }],
      // "Evet" without a date is no consent
      marketing: { email: new Date("2024-03-15T07:30:00Z"), sms: null },
    })
  })

  it("refuses a list without an e-mail column, and a consent dated in the future", async () => {
    await expect(sheetCustomers(csv("Ad,Soyad\nAyşe,Kaya\n"))).rejects.toThrow()
    const [later] = await sheetCustomers(csv("Email,E-posta izni\nx@example.com,2999-01-01\n"))
    expect(later?.marketing).toBeNull()
  })
})
