import type * as Job from "../shipment-tracking"

jest.mock("../../workflows/shipping/refresh-shipment", () => ({
  refreshShipmentWorkflow: jest.fn(),
}))

const MINUTE = 60 * 1000
const VARIABLES = ["NODE_ENV", "SHIPMENT_POLL_MINUTES"] as const

type JobModule = typeof Job
type JobEnv = Partial<Record<(typeof VARIABLES)[number], string>>

const setEnv = (env: JobEnv): void => {
  for (const name of VARIABLES) {
    const value = env[name]
    if (value === undefined) {
      Reflect.deleteProperty(process.env, name)
    } else {
      process.env[name] = value
    }
  }
}

/** The job module as it loads under `env` (the interval is read at load). */
function loadJob(env: JobEnv): JobModule {
  const saved: JobEnv = Object.fromEntries(VARIABLES.map((name) => [name, process.env[name]]))
  setEnv(env)
  try {
    const loaded: JobModule[] = []
    jest.isolateModules(() => {
      loaded.push(jest.requireActual<JobModule>("../shipment-tracking"))
    })
    const [job] = loaded
    if (!job) {
      throw new Error("the job did not load")
    }
    return job
  } finally {
    setEnv(saved)
  }
}

/** How long ago a parcel must have been asked about for the job to ask again. */
async function recheckOf(job: JobModule, now: Date): Promise<number> {
  const listTrackedShipments = jest.fn().mockResolvedValue([])
  const container = { resolve: () => ({ listTrackedShipments }) }
  await job.pollShipments(container as never, now)
  const [filter] = listTrackedShipments.mock.calls[1] as [{ checked_at: { $lte: Date } }]
  return now.getTime() - filter.checked_at.$lte.getTime()
}

describe("shipment tracking job interval", () => {
  const now = new Date("2026-11-19T12:00:00Z")

  it("runs every 30 minutes and asks again after 25 by default", async () => {
    const job = loadJob({ NODE_ENV: "test" })
    expect(job.config.schedule).toBe("*/30 * * * *")
    expect(await recheckOf(job, now)).toBe(25 * MINUTE)
  })

  it("runs every minute locally with SHIPMENT_POLL_MINUTES=1", async () => {
    const job = loadJob({ NODE_ENV: "development", SHIPMENT_POLL_MINUTES: "1" })
    expect(job.config.schedule).toBe("*/1 * * * *")
    expect(await recheckOf(job, now)).toBe(50 * 1000)
  })

  it("keeps 30 minutes in production whatever the variable says", async () => {
    const job = loadJob({ NODE_ENV: "production", SHIPMENT_POLL_MINUTES: "1" })
    expect(job.config.schedule).toBe("*/30 * * * *")
    expect(await recheckOf(job, now)).toBe(25 * MINUTE)
  })
})
