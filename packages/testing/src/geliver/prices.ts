import type { Handler } from "./routes"
import { failed, ok } from "./routes"

/** The services the fake prices: lira per desi on a base, and an average time in hours. */
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

/** The fake's price for a service and a desi, as Geliver's decimal string. */
export const fakePrice = (service: (typeof FAKE_SERVICES)[number], desi: number): string =>
  (service.base + service.perDesi * Math.ceil(desi)).toFixed(2)

/** `GET /priceList?paramType=parcel&…`: every service's price for the parcel. */
export const priceList: Handler = ({ query }) => {
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
  const desi = fakeDesi(parcel)
  return ok(
    FAKE_SERVICES.map((service) => ({
      providerCode: service.providerCode,
      providerServiceCode: service.providerServiceCode,
      totalAmount: fakePrice(service, desi),
      currency: "TRY",
      averageEstimatedTime: service.hours,
    }))
  )
}
