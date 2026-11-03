import type { Handler } from "./routes"
import { failed, ok } from "./routes"

/**
 * What the fake Geliver charges. The tests price two services on a
 * formula they can work out (`FAKE_SERVICES`); a developer's fake prices
 * the carriers Geliver sells, by desi band in lira as their price lists
 * go (`MARKET_SERVICES`; amounts of late 2026 by our estimate, a real
 * account's prices differ by contract).
 */

/** A service the fake offers: its codes, an average time in hours, its price for a desi. */
export interface FakeService {
  providerCode: string
  providerServiceCode: string
  hours: number
  price: (desi: number) => number
}

/** The tests' services: lira per desi on a base. */
export const FAKE_SERVICES = [
  { providerCode: "MNG", providerServiceCode: "MNG_STANDART", base: 50, perDesi: 10, hours: 48 },
  {
    providerCode: "YURTICI",
    providerServiceCode: "YURTICI_STANDART",
    base: 60,
    perDesi: 8,
    hours: 24,
  },
] as const

/** The desi Geliver would charge for a parcel: the larger of kilograms and cm³ / 3000. */
export const fakeDesi = (parcel: {
  length: number
  width: number
  height: number
  weight: number
}) => Math.max(parcel.weight, (parcel.length * parcel.width * parcel.height) / 3000)

/** The tests' price for a service and a desi, as Geliver's decimal string. */
export const fakePrice = (service: (typeof FAKE_SERVICES)[number], desi: number): string =>
  (service.base + service.perDesi * Math.ceil(desi)).toFixed(2)

export const TEST_SERVICES: readonly FakeService[] = FAKE_SERVICES.map((service) => ({
  providerCode: service.providerCode,
  providerServiceCode: service.providerServiceCode,
  hours: service.hours,
  price: (desi) => Number(fakePrice(service, desi)),
}))

// The desi bands' upper ends; above the last, each further desi costs `extra`
const BANDS = [1, 2, 3, 5, 10, 15, 20, 30] as const
const TOP = 30

const banded =
  (prices: readonly number[], extra: number) =>
  (desi: number): number => {
    const band = BANDS.findIndex((top) => desi <= top)
    const last = prices[prices.length - 1] ?? 0
    return band >= 0 ? (prices[band] ?? last) : last + extra * Math.ceil(desi - TOP)
  }

/** The carriers Geliver sells, priced by desi band. */
export const MARKET_SERVICES: readonly FakeService[] = [
  {
    providerCode: "PTT",
    providerServiceCode: "PTT_STANDART",
    hours: 72,
    price: banded([84.9, 92.9, 102.9, 119.9, 164.9, 224.9, 284.9, 399.9], 13.9),
  },
  {
    providerCode: "SURAT",
    providerServiceCode: "SURAT_STANDART",
    hours: 48,
    price: banded([89.9, 96.9, 106.9, 124.9, 169.9, 229.9, 289.9, 404.9], 14.9),
  },
  {
    providerCode: "MNG",
    providerServiceCode: "MNG_STANDART",
    hours: 48,
    price: banded([92.9, 99.9, 109.9, 129.9, 174.9, 239.9, 299.9, 419.9], 15.9),
  },
  {
    providerCode: "ARAS",
    providerServiceCode: "ARAS_STANDART",
    hours: 36,
    price: banded([99.9, 107.9, 119.9, 139.9, 184.9, 254.9, 314.9, 439.9], 16.9),
  },
  {
    providerCode: "YURTICI",
    providerServiceCode: "YURTICI_STANDART",
    hours: 24,
    price: banded([104.9, 112.9, 124.9, 144.9, 194.9, 264.9, 329.9, 459.9], 17.9),
  },
]

/** The offers for a parcel of `desi`, as Geliver lists them (without ids). */
export const offersFor = (services: readonly FakeService[], desi: number) =>
  services.map((service) => ({
    providerCode: service.providerCode,
    providerServiceCode: service.providerServiceCode,
    totalAmount: service.price(desi).toFixed(2),
    currency: "TRY",
    averageEstimatedTime: service.hours,
  }))

/** `GET /priceList?paramType=parcel&…`: every service's price for the parcel. */
export const priceListOf =
  (services: readonly FakeService[]): Handler =>
  ({ query }) => {
    const read = (name: string) => Number(query.get(name))
    const parcel = {
      length: read("length"),
      width: read("width"),
      height: read("height"),
      weight: read("weight"),
    }
    if (
      query.get("paramType") !== "parcel" ||
      Object.values(parcel).some((value) => !Number.isFinite(value) || value <= 0)
    ) {
      return failed(400, "VALIDATION_ERROR", "parcel measures required")
    }
    return ok(offersFor(services, fakeDesi(parcel)))
  }
