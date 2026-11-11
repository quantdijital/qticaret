import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { layoutOf } from "../local/layout"
import { healthOf, isPortFree, ownedPid, startShop, stopShop } from "../local/process"

jest.setTimeout(30_000)

// A stand-in for `medusa start -p <port>`: answers /health with 200
const SERVER = [
  "const port = Number(process.argv[process.argv.indexOf('-p') + 1])",
  "require('node:http').createServer((req, res) => res.writeHead(req.url === '/health' ? 200 : 404).end()).listen(port, '127.0.0.1')",
].join("\n")

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function freePort(): Promise<number> {
  for (let port = 9290; port <= 9299; port++) {
    if (await isPortFree(port)) {
      return port
    }
  }
  throw new Error("no free port in 9290-9299")
}

describe("a local shop's process (Ek C10)", () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "qt-c10-proc-"))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it("starts detached with a pid file, answers its health, and stops only its own pid", async () => {
    const layout = layoutOf("atolye-bicak", root)
    await mkdir(dirname(layout.cli), { recursive: true })
    await writeFile(layout.cli, SERVER)
    await mkdir(layout.serverDir, { recursive: true })
    const port = await freePort()

    const pid = await startShop(layout, port, { PATH: process.env["PATH"] ?? "" })
    expect(Number((await readFile(layout.pidFile, "utf8")).trim())).toBe(pid)
    let health = await healthOf(port)
    for (let i = 0; i < 40 && health.status !== 200; i++) {
      await pause(100)
      health = await healthOf(port)
    }
    expect(health.status).toBe(200)
    expect(await ownedPid(layout, port)).toBe(pid)
    // Another port is another shop: not this process
    expect(await ownedPid(layout, port + 1)).toBeNull()
    await expect(startShop(layout, port, {})).rejects.toMatchObject({
      code: "provisioning.port_in_use",
    })

    expect(await stopShop(layout, port)).toBe(true)
    expect(await isPortFree(port)).toBe(true)
    await expect(readFile(layout.pidFile, "utf8")).rejects.toThrow()
  })

  it("never signals a pid that is not the shop's", async () => {
    const layout = layoutOf("atolye-bicak", root)
    await mkdir(layout.dir, { recursive: true })
    // The test runner's own pid, as if the file pointed elsewhere
    await writeFile(layout.pidFile, `${String(process.pid)}\n`)
    expect(await ownedPid(layout, 9231)).toBeNull()
    expect(await stopShop(layout, 9231)).toBe(false)
    // Still here, and the file naming a live process is left alone
    expect(await readFile(layout.pidFile, "utf8")).toContain(String(process.pid))
  })
})
