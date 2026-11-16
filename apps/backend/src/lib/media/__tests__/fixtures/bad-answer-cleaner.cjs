// A stand-in cleaner for svg-worker.unit.spec.ts: answers with a box that is no number.
exports.cleanSvg = () => ({ buffer: Buffer.from("<svg/>"), width: Number.NaN, height: 1 })
