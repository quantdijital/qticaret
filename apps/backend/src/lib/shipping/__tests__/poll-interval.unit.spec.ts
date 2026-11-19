import { logger } from "../../logging"
import { DEFAULT_POLL_MINUTES, pollIntervalFrom, shipmentPollInterval } from "../poll-interval"

const MINUTE = 60 * 1000

describe("shipment poll interval", () => {
  beforeEach(() => {
    jest.spyOn(logger, "warn").mockImplementation(() => undefined)
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("runs every 30 minutes and asks again after 25 when unset or empty", () => {
    for (const raw of [undefined, "", "  "]) {
      expect(pollIntervalFrom("development", raw)).toEqual({
        minutes: 30,
        schedule: "*/30 * * * *",
        recheckMs: 25 * MINUTE,
        invalid: false,
      })
    }
    expect(DEFAULT_POLL_MINUTES).toBe(30)
  })

  it("runs every minute locally with 1, asking again after 50 seconds", () => {
    for (const nodeEnv of ["development", "test"]) {
      expect(pollIntervalFrom(nodeEnv, "1")).toEqual({
        minutes: 1,
        schedule: "*/1 * * * *",
        recheckMs: 50 * 1000,
        invalid: false,
      })
    }
    expect(pollIntervalFrom("development", " 10 ")).toMatchObject({
      schedule: "*/10 * * * *",
      recheckMs: (10 * MINUTE * 5) / 6,
    })
  })

  it("keeps today's 25 of 30 at 30", () => {
    expect(pollIntervalFrom("development", "30")).toMatchObject({
      schedule: "*/30 * * * *",
      recheckMs: 25 * MINUTE,
      invalid: false,
    })
  })

  it.each(["0", "31", "-1", "1.5", "abc", "5m", "1e1", "0x10"])(
    "falls back to 30 minutes on %p",
    (raw) => {
      expect(pollIntervalFrom("development", raw)).toEqual({
        minutes: 30,
        schedule: "*/30 * * * *",
        recheckMs: 25 * MINUTE,
        invalid: true,
      })
    }
  )

  it.each(["production", "staging", undefined])("ignores the variable on %p", (nodeEnv) => {
    for (const raw of ["1", "abc"]) {
      expect(pollIntervalFrom(nodeEnv, raw)).toEqual({
        minutes: 30,
        schedule: "*/30 * * * *",
        recheckMs: 25 * MINUTE,
        invalid: false,
      })
    }
  })

  it("warns once on an invalid value, naming the variable but not its value", () => {
    const interval = shipmentPollInterval({
      NODE_ENV: "development",
      SHIPMENT_POLL_MINUTES: "secret-ish",
    })
    expect(interval).toEqual({ minutes: 30, schedule: "*/30 * * * *", recheckMs: 25 * MINUTE })
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(jest.mocked(logger.warn).mock.calls)).not.toContain("secret-ish")
  })

  it("does not warn on a valid value or where the variable is ignored", () => {
    shipmentPollInterval({ NODE_ENV: "development", SHIPMENT_POLL_MINUTES: "1" })
    shipmentPollInterval({ NODE_ENV: "production", SHIPMENT_POLL_MINUTES: "abc" })
    shipmentPollInterval({ NODE_ENV: "development" })
    expect(logger.warn).not.toHaveBeenCalled()
  })
})
