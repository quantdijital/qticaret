import { perIpScale } from "../profiles"

// ipBucket moved to @qticaret/server-kit with its tests (adr/0061, C3)
describe("perIpScale", () => {
  it("relaxes per-IP limits only under NODE_ENV=test with the flag set", () => {
    expect(perIpScale({ NODE_ENV: "test", RATE_LIMIT_RELAXED: "1" })).toBe(100)
    expect(perIpScale({ NODE_ENV: "production", RATE_LIMIT_RELAXED: "1" })).toBe(1)
    expect(perIpScale({ NODE_ENV: "test" })).toBe(1)
    expect(perIpScale({ RATE_LIMIT_RELAXED: "1" })).toBe(1)
  })

  it("grows them a thousand times for a load test, never where a shop is live", () => {
    expect(perIpScale({ NODE_ENV: "staging", LOAD_TEST: "on" })).toBe(1000)
    expect(perIpScale({ NODE_ENV: "development", LOAD_TEST: "on" })).toBe(1000)
    expect(perIpScale({ NODE_ENV: "production", LOAD_TEST: "on" })).toBe(1)
    expect(perIpScale({ LOAD_TEST: "on" })).toBe(1)
    expect(perIpScale({ NODE_ENV: "staging", LOAD_TEST: "off" })).toBe(1)
  })
})
