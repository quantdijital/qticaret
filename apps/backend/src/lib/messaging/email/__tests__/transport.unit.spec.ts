import { logger } from "../../../logging"
import { emailTransport } from ".."

const ENV = ["EMAIL_TRANSPORT", "EMAIL_FROM", "MAILPIT_URL"] as const

describe("the instance's e-mail transport", () => {
  let logged: jest.SpyInstance

  beforeEach(() => {
    logged = jest.spyOn(logger, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    for (const name of ENV) {
      Reflect.deleteProperty(process.env, name)
    }
    logged.mockRestore()
  })

  it("tells the operator once per setting when nothing sends the shop's e-mail", () => {
    Object.assign(process.env, {
      EMAIL_TRANSPORT: "mailpit",
      EMAIL_FROM: "bildirim@platform.example",
      MAILPIT_URL: "http://127.0.0.1:8025",
    })
    expect(emailTransport()).not.toBeNull()
    expect(logged).not.toHaveBeenCalled()

    Reflect.deleteProperty(process.env, "EMAIL_TRANSPORT")
    expect(emailTransport()).toBeNull()
    expect(emailTransport()).toBeNull()
    // The platform's setting: an error with a stable event to alert on, not a line per e-mail
    expect(logged).toHaveBeenCalledTimes(1)
    expect(logged).toHaveBeenCalledWith({ event: "messaging.email_transport_missing" })
  })
})
