import { describe, expect, it } from "vitest";
import { createSaveQueue } from "./save-queue";

describe("ordered snapshot saves", () => {
  it("waits for earlier writes before saving the latest snapshot", async () => {
    const writes: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const save = createSaveQueue(async (value: number) => { if (value === 1) await gate; writes.push(value); });
    const first = save(1); const latest = save(2);
    await Promise.resolve(); expect(writes).toEqual([]);
    release(); await Promise.all([first, latest]); expect(writes).toEqual([1, 2]);
  });
  it("allows a retry after a failed write without hiding its error", async () => {
    const writes: number[] = [];
    const save = createSaveQueue(async (value: number) => { if (value === 1) throw new Error("disk full"); writes.push(value); });
    const failed = save(1); const next = save(2);
    await expect(failed).rejects.toThrow("disk full"); await next; expect(writes).toEqual([2]);
  });
});
