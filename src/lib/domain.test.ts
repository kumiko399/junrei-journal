import { describe, expect, it } from "vitest";
import { emptySnapshot, type Photo } from "../types";
import { addPhoto, formatSceneTime, importAnitabiPreview, localDate, normalizeTitle } from "./domain";

describe("domain helpers", () => {
  it("normalizes titles for migration", () => expect(normalizeTitle("  ＡＢＣ  ")).toBe("abc"));
  it("formats Anitabi timestamps", () => expect(formatSceneTime(282)).toBe("04:42"));
  it("uses the local calendar date at midnight", () => expect(localDate(new Date(2026, 8, 30, 0, 15))).toBe("2026-09-30"));
  it("does not insert duplicate photo IDs or hashes", () => {
    const photo: Photo = { id: "photo-1", spotId: "spot-1", sha256: "same-hash", relativePath: "media/test.jpg", photoType: "visit", sortOrder: 0, isCover: false, createdAt: "2026-09-30" };
    const first = addPhoto(emptySnapshot(), photo);
    expect(addPhoto(first, photo)).toBe(first);
    expect(addPhoto(first, { ...photo, id: "photo-2" })).toBe(first);
    expect(addPhoto(first, { ...photo, id: "photo-3", sha256: "new-hash" }).photos).toHaveLength(2);
  });
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
