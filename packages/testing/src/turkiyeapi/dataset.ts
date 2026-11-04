/**
 * A small synthetic TürkiyeAPI v2 dataset (adr/0008 Ek 2026-11-04) in its
 * record shapes: all 81 provinces, so the import's completeness check
 * passes, one district each, and a few places worth a test. Names and
 * postal codes are made up where it does not matter ("Örnek İl 05");
 * no real dataset is copied here.
 *
 * - İstanbul: Kadıköy (Caferağa, Fenerbahçe, Rasimpaşa with a derived
 *   postal code) and Adalar (Burgazada);
 * - Ankara: Çankaya (Kızılay, Bahçelievler with an estimated code);
 * - Afyonkarahisar: Merkez (Dumlupınar; the village Alcalı) and Sandıklı,
 *   where the centre and two towns (Kırka, Akın) each have a "Fatih" with
 *   its own postal code, and a village "Fatih" too.
 */

export interface FakeProvince {
  id: number
  name: string
  slug: string
}
export interface FakeDistrict {
  id: number
  name: string
  slug: string
  provinceId: number
}
export interface FakeMunicipality {
  id: number
  name: string
  slug: string
  type: "province_center" | "district_center" | "town"
  provinceId: number
  districtId: number
}
export interface FakeNeighborhood {
  id: number
  name: string
  slug: string
  provinceId: number
  districtId: number
  municipalityId: number
  postalCode: string
  postalCodeStatus: "official" | "derived" | "estimated"
}
export interface FakeVillage {
  id: number
  name: string
  slug: string
  provinceId: number
  districtId: number
  postalCode: string
  postalCodeStatus: "official" | "estimated"
}

export interface FakeTurkiyeApiDataset {
  provinces: FakeProvince[]
  districts: FakeDistrict[]
  municipalities: FakeMunicipality[]
  neighborhoods: FakeNeighborhood[]
  villages: FakeVillage[]
}

const slug = (name: string) =>
  name
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")

const NAMED: Record<number, string> = { 3: "Afyonkarahisar", 6: "Ankara", 34: "İstanbul" }
// The district each province gets (id 1000 + plate); the named ones' own
const FIRST_DISTRICT: Record<number, string> = { 6: "Çankaya", 34: "Kadıköy" }

export const FAKE_IDS = {
  kadikoy: 1034,
  adalar: 2034,
  cankaya: 1006,
  afyonMerkez: 1003,
  sandikli: 2003,
  kirka: 7001,
  akin: 7002,
} as const

export function fakeTurkiyeApiDataset(): FakeTurkiyeApiDataset {
  const provinces: FakeProvince[] = []
  const districts: FakeDistrict[] = []
  for (let plate = 1; plate <= 81; plate++) {
    const name = NAMED[plate] ?? `Örnek İl ${String(plate).padStart(2, "0")}`
    provinces.push({ id: plate, name, slug: slug(name) })
    const district = FIRST_DISTRICT[plate] ?? "Merkez"
    districts.push({ id: 1000 + plate, name: district, slug: slug(district), provinceId: plate })
  }
  districts.push(
    { id: FAKE_IDS.adalar, name: "Adalar", slug: "adalar", provinceId: 34 },
    { id: FAKE_IDS.sandikli, name: "Sandıklı", slug: "sandikli", provinceId: 3 }
  )
  const municipalities: FakeMunicipality[] = districts.map((district) => ({
    id: 5000 + district.id,
    name: district.name,
    slug: district.slug,
    type: "district_center",
    provinceId: district.provinceId,
    districtId: district.id,
  }))
  municipalities.push({ ...town("Kırka", FAKE_IDS.kirka) }, { ...town("Akın", FAKE_IDS.akin) })

  let next = 10_001
  const neighborhood = (
    name: string,
    districtId: number,
    postalCode: string,
    status: FakeNeighborhood["postalCodeStatus"] = "official",
    municipalityId = 5000 + districtId
  ): FakeNeighborhood => ({
    id: next++,
    name,
    slug: slug(name),
    provinceId: Number(postalCode.slice(0, 2)),
    districtId,
    municipalityId,
    postalCode,
    postalCodeStatus: status,
  })
  const neighborhoods = [
    neighborhood("Caferağa", FAKE_IDS.kadikoy, "34710"),
    neighborhood("Fenerbahçe", FAKE_IDS.kadikoy, "34726"),
    neighborhood("Rasimpaşa", FAKE_IDS.kadikoy, "34716", "derived"),
    neighborhood("Burgazada", FAKE_IDS.adalar, "34975"),
    neighborhood("Kızılay", FAKE_IDS.cankaya, "06420"),
    neighborhood("Bahçelievler", FAKE_IDS.cankaya, "06490", "estimated"),
    neighborhood("Dumlupınar", FAKE_IDS.afyonMerkez, "03100"),
    neighborhood("Fatih", FAKE_IDS.sandikli, "03500"),
    neighborhood("Fatih", FAKE_IDS.sandikli, "03510", "official", FAKE_IDS.kirka),
    neighborhood("Cumhuriyet", FAKE_IDS.sandikli, "03510", "official", FAKE_IDS.kirka),
    neighborhood("Fatih", FAKE_IDS.sandikli, "03520", "official", FAKE_IDS.akin),
  ]
  const villages: FakeVillage[] = [
    village(20_001, "Alcalı", FAKE_IDS.afyonMerkez, "03032"),
    village(20_002, "Fatih", FAKE_IDS.sandikli, "03530", "estimated"),
  ]
  return { provinces, districts, municipalities, neighborhoods, villages }
}

function town(name: string, id: number): FakeMunicipality {
  return { id, name, slug: slug(name), type: "town", provinceId: 3, districtId: FAKE_IDS.sandikli }
}

function village(
  id: number,
  name: string,
  districtId: number,
  postalCode: string,
  status: FakeVillage["postalCodeStatus"] = "official"
): FakeVillage {
  return {
    id,
    name,
    slug: slug(name),
    provinceId: Number(postalCode.slice(0, 2)),
    districtId,
    postalCode,
    postalCodeStatus: status,
  }
}
