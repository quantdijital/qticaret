import {
  MAX_READ_IDS,
  READ_STATE_KEY,
  WHOLESALE_ORDER_TRIGGER,
  allReadUntil,
  feedFilters,
  isUnread,
  readFloor,
  readStateOf,
  visibleFeed,
  withRead,
} from "../feed"

const NOTHING = { until: null, ids: [] }

describe("the bell's read state (adr/0020)", () => {
  it("reads what a user record keeps, and nothing from what it cannot read", () => {
    expect(readStateOf(null)).toEqual(NOTHING)
    expect(readStateOf({ [READ_STATE_KEY]: "x" })).toEqual(NOTHING)
    expect(readStateOf({ [READ_STATE_KEY]: { until: "nope", ids: ["noti_1", 2] } })).toEqual({
      until: null,
      ids: ["noti_1"],
    })
    expect(
      readStateOf({ [READ_STATE_KEY]: { until: "2026-11-16T10:00:00.000Z", ids: [] } }).until
    ).toBe("2026-11-16T10:00:00.000Z")
  })

  it("counts nothing before the last 'all read' or the day the person joined as unread", () => {
    const joined = "2026-11-01T00:00:00.000Z"
    expect(readFloor(NOTHING, joined)?.toISOString()).toBe(joined)
    const later = { until: "2026-11-10T00:00:00.000Z", ids: [] }
    expect(readFloor(later, joined)?.toISOString()).toBe(later.until)
    expect(readFloor(NOTHING, null)).toBeNull()
    const floor = readFloor(later, joined)
    expect(isUnread({ id: "a", created_at: "2026-11-09T00:00:00.000Z" }, later, floor)).toBe(false)
    expect(isUnread({ id: "a", created_at: "2026-11-11T00:00:00.000Z" }, later, floor)).toBe(true)
    expect(
      isUnread({ id: "a", created_at: "2026-11-11T00:00:00.000Z" }, withRead(later, ["a"]), floor)
    ).toBe(false)
  })

  it("keeps each id once and at most the cap, the newest; 'all read' forgets them", () => {
    const once = withRead(withRead(NOTHING, ["a", "b"]), ["b", "c"])
    expect(once.ids).toEqual(["a", "b", "c"])
    const many = withRead(
      NOTHING,
      Array.from({ length: MAX_READ_IDS + 5 }, (_, index) => `n${String(index)}`)
    )
    expect(many.ids).toHaveLength(MAX_READ_IDS)
    expect(many.ids[0]).toBe("n5")
    expect(allReadUntil(new Date("2026-11-16T10:00:00.000Z"))).toEqual({
      until: "2026-11-16T10:00:00.000Z",
      ids: [],
    })
  })
})

describe("the feed's filters", () => {
  const floor = new Date("2026-11-10T00:00:00.000Z")
  const state = { until: floor.toISOString(), ids: ["noti_1"] }

  it("is the feed alone for the owner, who gets every kind", () => {
    expect(
      feedFilters({
        state: "all",
        group: null,
        readState: state,
        floor,
        visible: null,
      })
    ).toEqual({ channel: "feed" })
  })

  it("holds anyone else to the kinds their role gets: no untyped or unknown row", () => {
    expect(
      feedFilters({
        state: "all",
        group: null,
        readState: state,
        floor,
        visible: ["stock.low"],
      })
    ).toEqual({ channel: "feed", $and: [{ trigger_type: ["stock.low"] }] })
  })

  it("narrows by a group's prefixes and by what is read or not", () => {
    expect(
      feedFilters({
        state: "unread",
        group: "stock",
        readState: state,
        floor,
        visible: null,
      })
    ).toEqual({
      channel: "feed",
      $and: [
        { $or: [{ trigger_type: { $like: "stock.%" } }] },
        { created_at: { $gt: floor } },
        { id: { $nin: ["noti_1"] } },
      ],
    })
    expect(
      feedFilters({
        state: "read",
        group: null,
        readState: state,
        floor,
        visible: null,
      })
    ).toEqual({
      channel: "feed",
      $and: [{ $or: [{ created_at: { $lte: floor } }, { id: ["noti_1"] }] }],
    })
  })

  it("gives marking read the same visible feed as the list", () => {
    expect(visibleFeed(null)).toEqual({ channel: "feed" })
    expect(visibleFeed([WHOLESALE_ORDER_TRIGGER])).toEqual({
      channel: "feed",
      $and: [{ trigger_type: [WHOLESALE_ORDER_TRIGGER] }],
    })
  })

  it("matches nothing read before anything is", () => {
    expect(
      feedFilters({
        state: "read",
        group: null,
        readState: NOTHING,
        floor: null,
        visible: null,
      })
    ).toBeNull()
  })
})
