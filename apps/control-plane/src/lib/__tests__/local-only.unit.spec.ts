import { localOnlyProblem } from "../local-only"

const DB = "postgres://postgres:pw@localhost:55432/qticaret_cp"

describe("a developer's script runs only here (C7 review L3)", () => {
  it.each([
    ["postgres://postgres:pw@localhost:55432/qticaret_cp"],
    ["postgres://postgres:pw@127.0.0.1:55432/qticaret_cp"],
    ["postgres://postgres:pw@[::1]:55432/qticaret_cp"],
  ])("takes a database on this machine: %s", (url) => {
    expect(localOnlyProblem({ NODE_ENV: "development", DATABASE_URL: url })).toBeNull()
  })

  it("refuses a deployed environment and a database elsewhere, naming neither", () => {
    expect(localOnlyProblem({ NODE_ENV: "production", DATABASE_URL: DB })).toBe(
      "only in development or test"
    )
    const remote = localOnlyProblem({
      NODE_ENV: "development",
      DATABASE_URL: "postgres://u:secret@10.0.0.5:5432/cp",
    })
    expect(remote).toBe("only against a database on this machine")
    expect(localOnlyProblem({ NODE_ENV: "test", DATABASE_URL: "not a url" })).toBe(
      "only against a database on this machine"
    )
  })

  it.each([
    ["a host query parameter", "postgres://u:p@localhost:5432/cp?host=10.0.0.5"],
    ["a hostaddr query parameter", "postgres://u:p@localhost:5432/cp?hostaddr=10.0.0.5"],
    ["an upper-case host parameter", "postgres://u:p@localhost/cp?HOST=db.example.com"],
    ["a socket path", "postgres://u:p@%2Ftmp/cp"],
    ["an empty host", "postgres:///cp"],
    ["another scheme", "mysql://u:p@localhost/cp"],
    ["a name that only starts like localhost", "postgres://u:p@localhost.example.com/cp"],
  ])("refuses %s, read as the driver reads it", (_, url) => {
    expect(localOnlyProblem({ NODE_ENV: "development", DATABASE_URL: url })).toBe(
      "only against a database on this machine"
    )
  })

  it("takes a loopback host in any case and the postgresql scheme", () => {
    expect(
      localOnlyProblem({ NODE_ENV: "test", DATABASE_URL: "postgresql://u:p@LOCALHOST:5432/cp" })
    ).toBeNull()
  })
})
