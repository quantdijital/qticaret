import { spawnSync } from "node:child_process"
import { join } from "node:path"

/**
 * The main thread loads no cleaner: `svg.ts` takes only types from
 * `svg-clean.ts`, so jsdom and DOMPurify load in the worker alone. Read
 * in a fresh process (Jest's own module registry is no Node's).
 */

jest.setTimeout(60_000)

it("loads neither jsdom, DOMPurify nor the cleaner with svg.ts", () => {
  const script = `
require(${JSON.stringify(require.resolve("ts-node"))}).register({ transpileOnly: true, swc: true })
require(${JSON.stringify(join(__dirname, "../svg.ts"))})
const loaded = Object.keys(require.cache).filter((path) =>
  /[\\\\/](jsdom|dompurify)[\\\\/]/.test(path) || /svg-clean\\.[jt]s$/.test(path)
)
console.log("loaded", JSON.stringify(loaded))
`
  const run = spawnSync(process.execPath, ["-e", script], {
    timeout: 30_000,
    killSignal: "SIGKILL",
    encoding: "utf8",
    cwd: join(__dirname, "../../../.."),
    env: { ...process.env, NODE_ENV: "test" },
  })
  expect(`${run.stdout}${run.stderr}`.trim().split("\n").pop()).toBe("loaded []")
})
