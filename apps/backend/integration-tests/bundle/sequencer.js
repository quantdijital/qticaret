// jest's testSequencer while bundles are on (jest.config.js, QT_IT_BUNDLE):
// a --shard job takes its part by expected seconds, not by a hash of the
// paths, and its workers start on the heaviest files first. With bundles off
// jest's own sequencer runs, as before. README.md in this folder.
const path = require("node:path")
const { assignShards, heaviestFirst, testSeconds } = require("./shards")
const { loadWeights, weigher } = require("./weights")

// jest's default sequencer, reached the way jest itself reaches it
// (jest -> @jest/core -> jest-config -> @jest/test-sequencer): the backend
// does not depend on it directly
function baseSequencer() {
  let from = path.dirname(require.resolve("jest"))
  for (const name of ["@jest/core", "jest-config", "@jest/test-sequencer"]) {
    from = require.resolve(name, { paths: [from] })
  }
  return require(from).default
}

const posix = (file) => file.split(path.sep).join("/")

class WeightedSequencer extends baseSequencer() {
  weigh(tests) {
    const weightOf = weigher(loadWeights())
    return tests.map((test) => ({
      key: posix(path.relative(test.context.config.rootDir, test.path)),
      seconds: testSeconds(test.path, weightOf),
      test,
    }))
  }

  shard(tests, { shardIndex, shardCount }) {
    const parts = assignShards(this.weigh(tests), shardCount)
    return parts[shardIndex - 1].items.map((item) => item.test)
  }

  sort(tests) {
    return this.weigh(tests)
      .sort(heaviestFirst)
      .map((item) => item.test)
  }
}

module.exports = WeightedSequencer
