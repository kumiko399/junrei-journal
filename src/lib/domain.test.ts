import { describe, expect, it } from "vitest";
import { emptySnapshot } from "../types";
import { formatSceneTime, importAnitabiPreview, normalizeTitle } from "./domain";

describe("domain helpers", () => {
  it("normalizes titles for migration", () => expect(normalizeTitle("  ＡＢＣ  ")).toBe("abc"));
  it("formats Anitabi timestamps", () => expect(formatSceneTime(282)).toBe("04:42"));
  it("imports and then updates Anitabi points without duplicates", () => {
    const preview = { id: 1, cn: "测试作品", points: [{ id: "p1", name: "车站", geo: [35, 139] as [number, number], s: 62 }] };
    const first = importAnitabiPreview(emptySnapshot(), preview, new Set(["p1"]));
    const second = importAnitabiPreview(first.snapshot, { ...preview, points: [{ ...preview.points[0], name: "新车站" }] }, new Set(["p1"]));
    expect(first.added).toBe(1);
    expect(second.added).toBe(0);
    expect(second.updated).toBe(1);
    expect(second.snapshot.spots[0].name).toBe("新车站");
  });
});
