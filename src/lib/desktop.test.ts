import { afterEach, describe, expect, it, vi } from "vitest";
import { emptySnapshot } from "../types";
import { fetchAnitabi, loadSnapshot } from "./desktop";

afterEach(() => vi.unstubAllGlobals());
describe("preview storage", () => {
  it("rejects damaged data so it cannot be replaced by an empty snapshot", async () => {
    vi.stubGlobal("window", {}); vi.stubGlobal("localStorage", { getItem: () => "{broken" });
    await expect(loadSnapshot()).rejects.toThrow();
  });
  it("rejects unsupported data versions", async () => {
    vi.stubGlobal("window", {}); vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ ...emptySnapshot(), schemaVersion: 2 }) });
    await expect(loadSnapshot()).rejects.toThrow("数据格式无效");
  });
  it("fills missing settings in older snapshots", async () => {
    vi.stubGlobal("window", {}); vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ ...emptySnapshot(), settings: { theme: "dark" } }) });
    const snapshot = await loadSnapshot(); expect(snapshot.settings.theme).toBe("dark"); expect(snapshot.settings.mapProvider).toBe("open");
  });
});
it("reports the failing Anitabi response instead of HTTP 200", async () => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, status: 200 }).mockResolvedValueOnce({ ok: false, status: 404 }));
  await expect(fetchAnitabi(1)).rejects.toThrow("404");
});
