import { REDACTED } from "@qticaret/server-kit"
import { MedusaPinoLogger } from "../medusa-logger"
import { captureLogger } from "./capture"

const setup = (level: "http" | "info" | "silly" = "silly") => {
  const captured = captureLogger()
  return { ...captured, logger: new MedusaPinoLogger(captured.base, level) }
}

describe("MedusaPinoLogger", () => {
  it.each([
    ["silly", "trace"],
    ["debug", "debug"],
    ["verbose", "verbose"],
    ["http", "http"],
    ["info", "info"],
    ["warn", "warn"],
  ] as const)("writes %s lines at pino level %s", (method, level) => {
    const { logger, lines } = setup()

    logger[method]("message")

    expect(lines()[0]).toMatchObject({ level, msg: "message" })
  })

  it("maps Medusa's level names for shouldLog", () => {
    const { logger } = setup("info")

    expect(logger.shouldLog("info")).toBe(true)
    expect(logger.shouldLog("warn")).toBe(true)
    // Medusa's access log asks for `http`, which sits below info
    expect(logger.shouldLog("http")).toBe(false)
    expect(logger.shouldLog("not-a-level")).toBe(false)
  })

  it("sets the shared logger to its default level", () => {
    const { base } = setup("http")

    expect(base.level).toBe("http")
  })

  it("changes the level and returns to the default", () => {
    const { logger } = setup("info")

    logger.setLogLevel("debug")
    expect(logger.shouldLog("debug")).toBe(true)

    logger.setLogLevel("unknown")
    expect(logger.shouldLog("debug")).toBe(true)

    logger.unsetLogLevel()
    expect(logger.shouldLog("debug")).toBe(false)
  })

  describe("error", () => {
    it("logs a message with an error, cause redacted", () => {
      const { logger, lines, raw } = setup()
      const error = new Error("boom", { cause: { password: "hunter2" } })

      logger.error("Loader failed", error)

      expect(lines()[0]).toMatchObject({
        level: "error",
        msg: "Loader failed",
        err: { message: "boom", cause: { password: REDACTED } },
      })
      expect(raw()).not.toContain("hunter2")
    })

    it("logs an error on its own under its message", () => {
      const { logger, lines } = setup()

      logger.error(new Error("boom"))

      expect(lines()[0]).toMatchObject({ msg: "boom", err: { name: "Error" } })
    })

    it("strips SQL from the message it takes from the error", () => {
      const { logger, lines, raw } = setup()

      logger.error(
        new Error(`insert into "customer_address" ("address_1") values ('Bağdat Cad.') - too long`)
      )

      expect(lines()[0]).toMatchObject({ msg: "[SQL] too long" })
      expect(raw()).not.toContain("Bağdat")
    })

    it("accepts a plain object, as workflow errors arrive", () => {
      const { logger, lines } = setup()

      logger.error({ message: "step failed", token: "t-1" } as unknown as Error)

      expect(lines()[0]).toMatchObject({ msg: "step failed", err: { token: REDACTED } })
    })

    it("logs a bare message", () => {
      const { logger, lines } = setup()

      logger.error("failed")

      expect(lines()[0]).toMatchObject({ level: "error", msg: "failed" })
      expect(lines()[0]).not.toHaveProperty("err")
    })
  })

  describe("activities", () => {
    it("reports start, progress and success with a duration", () => {
      const { logger, lines } = setup()

      const id = logger.activity("Running migrations", { module: "x" })
      logger.progress(id, "halfway")
      const result = logger.success(id, "Migrations done")

      expect(lines()[0]).toMatchObject({ activity_id: id, config: { module: "x" } })
      expect(lines()[1]).toMatchObject({ activity_id: id, msg: "halfway" })
      expect(lines()[2]).toMatchObject({ activity_id: id, duration: expect.any(Number) as number })
      expect(result).toEqual({ duration: expect.any(Number) as number })
    })

    it("reports failure at error level and forgets the activity", () => {
      const { logger, lines } = setup()

      const id = logger.activity("Seeding")
      logger.failure(id, "Seeding failed")

      expect(lines()[1]).toMatchObject({ level: "error", activity_id: id })
      expect(logger.success(id, "again")).toEqual({})
    })
  })

  describe("log", () => {
    it("takes winston's level-first form", () => {
      const { logger, lines } = setup()

      logger.log("warn", "careful", { extra: 1 })

      expect(lines()[0]).toMatchObject({ level: "warn", msg: "careful", meta: [{ extra: 1 }] })
    })

    it("takes winston's object form", () => {
      const { logger, lines } = setup()

      logger.log({ level: "error", message: "bad", code: "E1" })

      expect(lines()[0]).toMatchObject({ level: "error", msg: "bad", meta: [{ code: "E1" }] })
    })

    it("adds no meta for an object without extra fields", () => {
      const { logger, lines } = setup()

      logger.log({ level: "warn", message: "plain" })

      expect(lines()[0]).not.toHaveProperty("meta")
    })

    it("logs a single message at info", () => {
      const { logger, lines } = setup()

      logger.log("redisUrl not found. A fake redis instance will be used.")

      expect(lines()[0]).toMatchObject({
        level: "info",
        msg: expect.stringContaining("redisUrl") as string,
      })
    })
  })

  it("exits after logging a panic", () => {
    const { logger, lines } = setup()
    const exit = jest.spyOn(process, "exit").mockImplementation((() => undefined) as () => never)

    try {
      logger.panic({ id: "10000", context: { secret: "s-1" } })

      expect(lines()[0]).toMatchObject({
        level: "fatal",
        event: "medusa.panic",
        details: { context: { secret: REDACTED } },
      })
      expect(exit).toHaveBeenCalledWith(1)
    } finally {
      exit.mockRestore()
    }
  })
})
