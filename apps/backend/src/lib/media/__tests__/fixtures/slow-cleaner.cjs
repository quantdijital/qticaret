// A stand-in cleaner for svg-worker.unit.spec.ts: holds its worker a while, then answers.
exports.cleanSvg = () => {
  const until = Date.now() + 400
  while (Date.now() < until) {
    // busy, as a slow file would keep the real cleaner
  }
  return { buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), width: 1, height: 1 }
}
