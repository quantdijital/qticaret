import { createHealthMonitor, runHealthChecks } from "../health"
import type { IntegrationHealthCheck } from "../health"

const check = (
  id: string,
  run: IntegrationHealthCheck["check"],
  kind = "test"
): IntegrationHealthCheck => ({ id, kind, check: run })

describe("runHealthChecks", () => {
  it("reports every check and ok when nothing is down", async () => {
    const report = await runHealthChecks([
      check("a", () => Promise.resolve({ status: "ok" })),
      check("b", () => Promise.resolve({ status: "not_configured" })),
    ])

    expect(report.status).toBe("ok")
    expect(report.checks).toEqual([
      expect.objectContaining({
        id: "a",
        kind: "test",
        status: "ok",
        latency_ms: expect.any(Number) as number,
      }),
      expect.objectContaining({ id: "b", status: "not_configured" }),
    ])
    expect(Date.parse(report.checked_at)).not.toBeNaN()
  })

  it("is degraded when a check is down and hides the error text", async () => {
    const report = await runHealthChecks([
      check("ok", () => Promise.resolve({ status: "ok" })),
      check("broken", () => Promise.reject(new Error("redis://:s3cret@10.0.0.5 refused"))),
    ])

    expect(report.status).toBe("degraded")
    expect(report.checks[1]).toMatchObject({ id: "broken", status: "down", reason: "error" })
    expect(JSON.stringify(report)).not.toContain("s3cret")
  })

  it("times out a check that ignores its signal, without waiting for it", async () => {
    const started = Date.now()

    const report = await runHealthChecks([check("hanging", () => new Promise(() => undefined))], {
      timeoutMs: 100,
    })

    expect(report.checks[0]).toMatchObject({ status: "down", reason: "timeout" })
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it("runs the checks in parallel", async () => {
    const slow = () =>
      new Promise<{ status: "ok" }>((resolve) =>
        setTimeout(() => {
          resolve({ status: "ok" })
        }, 150)
      )
    const started = Date.now()

    await runHealthChecks([check("a", slow), check("b", slow), check("c", slow)])

    expect(Date.now() - started).toBeLessThan(400)
  })
})

describe("createHealthMonitor", () => {
  it("reuses a report within the TTL and shares a run between concurrent callers", async () => {
    let now = 0
    let runs = 0
    const monitor = createHealthMonitor(
      [
        check("counted", () => {
          runs += 1
          return Promise.resolve({ status: "ok" })
        }),
      ],
      { ttlMs: 1000, now: () => now }
    )

    await Promise.all([monitor.report(), monitor.report()])
    now = 999
    await monitor.report()
    expect(runs).toBe(1)

    now = 1000
    await monitor.report()
    expect(runs).toBe(2)
  })
})
