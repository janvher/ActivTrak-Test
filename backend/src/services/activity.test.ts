import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fillEmptyBuckets } from "./activity.ts";

describe("fillEmptyBuckets", () => {
  it("fills missing hourly buckets with zeros", () => {
    const from = new Date("2026-07-23T10:15:00.000Z");
    const to = new Date("2026-07-23T13:00:00.000Z");
    const points = [
      {
        bucket: new Date("2026-07-23T11:00:00.000Z"),
        activeMs: 1000,
        idleMs: 0,
      },
    ];
    const filled = fillEmptyBuckets({ from, to }, "hour", points);
    assert.deepEqual(
      filled.map((p) => p.bucket.toISOString()),
      [
        "2026-07-23T10:00:00.000Z",
        "2026-07-23T11:00:00.000Z",
        "2026-07-23T12:00:00.000Z",
      ],
    );
    assert.equal(filled[0]?.activeMs, 0);
    assert.equal(filled[1]?.activeMs, 1000);
  });
});
