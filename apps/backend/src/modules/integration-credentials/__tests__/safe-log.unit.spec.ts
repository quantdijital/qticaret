import { EnvelopeError } from "@qticaret/server-kit"
import { logger } from "../../../lib/logging"
import { failureCode, logCredentialFailure } from "../safe-log"

// A sealed text as it would sit in a failed statement's bound values
const sealed = `qtenv1.0123456789abcdef.${"A".repeat(43)}.${"B".repeat(60)}`

/** What knex throws: the SQL with its values in the message, a SQLSTATE in `code`. */
function databaseError(): Error {
  const error = new Error(
    `UPDATE integration_credential SET secret_ciphertext = '${sealed}', key_id = '0123456789abcdef' ` +
      `WHERE id = 'icred_1' AND secret_ciphertext = '${sealed}' - canceling statement due to statement timeout`
  ) as Error & { code: string; cause: unknown }
  error.code = "57014"
  error.cause = { sql: error.message }
  return error
}

describe("credential failure logs (adr/0061 Ek C17 review L2)", () => {
  it("writes the event, the provider and the code; nothing of the SQL or its values", () => {
    const warned = jest.spyOn(logger, "warn").mockImplementation(() => undefined)
    try {
      logCredentialFailure("warn", "integration_credentials.upgrade_failed", databaseError(), {
        provider: "paytr",
      })

      expect(warned).toHaveBeenCalledWith({
        event: "integration_credentials.upgrade_failed",
        provider: "paytr",
        code: "57014",
      })
      const written = JSON.stringify(warned.mock.calls)
      expect(written).not.toContain("qtenv1")
      expect(written).not.toContain("UPDATE")
      expect(written).not.toContain("icred_1")
    } finally {
      warned.mockRestore()
    }
  })

  it("takes only a code that looks like one", () => {
    expect(failureCode(new EnvelopeError("envelope.open_failed"))).toBe("envelope.open_failed")
    expect(failureCode(Object.assign(new Error("x"), { code: 404 }))).toBe("404")
    // A code carrying text is not a code
    expect(failureCode(Object.assign(new Error("x"), { code: `bad ${sealed}` }))).toBe("unknown")
    expect(failureCode(new Error(sealed))).toBe("unknown")
    expect(failureCode(sealed)).toBe("unknown")
    expect(failureCode(null)).toBe("unknown")
  })
})
