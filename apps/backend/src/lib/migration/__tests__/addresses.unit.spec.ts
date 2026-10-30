import { oldAddressOf } from "../addresses"

describe("an old site's address as rules store it (F14.7)", () => {
  it("takes a path or a full URL, normalised, its query sorted apart", () => {
    expect(oldAddressOf("/Urun/Ah%C5%9Fap-Ka%C5%9F%C4%B1k/")).toEqual({
      address: "/urun/ahşap-kaşık",
      path: "/urun/ahşap-kaşık",
      query: null,
    })
    expect(oldAddressOf("https://eski.example.com/urun.php?id=12&renk=kirmizi#yorumlar")).toEqual({
      address: "/urun.php?id=12&renk=kirmizi",
      path: "/urun.php",
      query: "id=12&renk=kirmizi",
    })
    // Two orders of one query are one address
    expect(oldAddressOf("/ara?q=tava&sayfa=2")?.address).toBe(
      oldAddressOf("/ara?sayfa=2&q=tava")?.address
    )
  })

  it("refuses what no page can have", () => {
    expect(oldAddressOf("/a/../b")).toBeNull()
    expect(oldAddressOf("urun/x")).toBeNull()
    expect(oldAddressOf("https://")).toBeNull()
  })
})
