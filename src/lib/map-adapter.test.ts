import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapOptions } from "./map-adapter";

vi.mock("maplibre-gl", () => ({ default: {} }));
beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const options = (): MapOptions => ({ center: { latitude: 35, longitude: 139 }, zoom: 9, tileUrl: "", googleApiKey: "test-key", onSpotSelect: vi.fn(), onCoordinatePick: vi.fn(), onViewChange: vi.fn(), onError: vi.fn() });
function setup() {
  const scripts: { onerror?: () => void; remove: ReturnType<typeof vi.fn> }[] = [];
  const windowMock = { setTimeout, clearTimeout } as unknown as Window;
  vi.stubGlobal("window", windowMock);
  vi.stubGlobal("document", { createElement: () => { const script = { remove: vi.fn() }; scripts.push(script); return script; }, head: { append: vi.fn() } });
  const maps = { Map: vi.fn(function () { return { addListener: vi.fn(), setOptions: vi.fn() }; }), event: { clearInstanceListeners: vi.fn() } };
  return { scripts, windowMock, maps };
}

describe("Google map lifecycle", () => {
  it("times out instead of waiting forever when the script never calls back", async () => {
    const { scripts } = setup();
    const { GoogleMapAdapter } = await import("./map-adapter");
    const mounted = new GoogleMapAdapter().mount({} as HTMLElement, options());
    const failed = expect(mounted).rejects.toThrow("Google Maps 加载失败");
    await vi.advanceTimersByTimeAsync(15000); await failed; expect(scripts[0].remove).toHaveBeenCalled();
  });
  it("allows another attempt after a script error", async () => {
    const { scripts, windowMock, maps } = setup();
    const { GoogleMapAdapter } = await import("./map-adapter");
    const mounted = new GoogleMapAdapter().mount({} as HTMLElement, options());
    const failed = expect(mounted).rejects.toThrow("Google Maps 加载失败"); scripts[0].onerror?.(); await failed;
    const retried = new GoogleMapAdapter().mount({} as HTMLElement, options());
    expect(scripts).toHaveLength(2); windowMock.google = { maps }; windowMock.__junreiGoogleReady?.(); await retried;
    expect(maps.Map).toHaveBeenCalledOnce();
  });
  it("does not create a map after its view was destroyed during loading", async () => {
    const { windowMock, maps } = setup(); const { GoogleMapAdapter } = await import("./map-adapter");
    const adapter = new GoogleMapAdapter(); const mounted = adapter.mount({} as HTMLElement, options());
    adapter.destroy(); windowMock.google = { maps }; windowMock.__junreiGoogleReady?.(); await mounted;
    expect(maps.Map).not.toHaveBeenCalled();
  });
  it("reports authentication failure after initialization and removes listeners on exit", async () => {
    const { windowMock, maps } = setup(); windowMock.google = { maps };
    const { GoogleMapAdapter } = await import("./map-adapter"); const adapter = new GoogleMapAdapter(); const config = options();
    await adapter.mount({} as HTMLElement, config); windowMock.gm_authFailure?.();
    expect(config.onError).toHaveBeenCalledWith(expect.stringContaining("密钥验证失败"));
    adapter.destroy(); expect(windowMock.gm_authFailure).toBeUndefined(); expect(maps.event.clearInstanceListeners).toHaveBeenCalled();
  });
});
