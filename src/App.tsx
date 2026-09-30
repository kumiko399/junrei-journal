import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Camera, Database, Home, LoaderCircle, Map, MapPinned, Settings, Stamp } from "lucide-react";
import type { AppSnapshot } from "./types";
import { emptySnapshot } from "./types";
import { loadSnapshot, saveSnapshot } from "./lib/desktop";
import { createSaveQueue } from "./lib/save-queue";
import { DashboardView } from "./views/DashboardView";
import { WorksView } from "./views/WorksView";
import { MapView } from "./views/MapView";
import { VisitsView } from "./views/VisitsView";
import { GalleryView } from "./views/GalleryView";
import { ImportView } from "./views/ImportView";
import { SettingsView } from "./views/SettingsView";

export type ViewName = "dashboard" | "works" | "map" | "visits" | "gallery" | "import" | "settings";
const navigation: { id: ViewName; label: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "首页", icon: Home }, { id: "works", label: "作品库", icon: BookOpen },
  { id: "map", label: "巡礼地图", icon: Map }, { id: "visits", label: "到访记录", icon: Stamp },
  { id: "gallery", label: "照片墙", icon: Camera }, { id: "import", label: "数据导入", icon: Database },
  { id: "settings", label: "设置", icon: Settings },
];

export default function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(emptySnapshot());
  const [view, setView] = useState<ViewName>("dashboard");
  const [initialSpotId, setInitialSpotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<AppSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeInProgress = useRef(false);
  const saved = useRef<AppSnapshot | null>(null);
  const latest = useRef(snapshot);
  latest.current = snapshot;
  const enqueue = useRef(createSaveQueue(saveSnapshot));

  const reload = async () => {
    setLoading(true); setLoadFailed(false); setError("");
    try { const next = await loadSnapshot(); saved.current = next; setLastSaved(next); setSnapshot(next); }
    catch (e) { setLoadFailed(true); setError(e instanceof Error ? e.message : String(e || "无法读取本地数据")); }
    finally { setLoading(false); }
  };
  const flushSave = async () => {
    const next = latest.current;
    if (loadFailed) throw new Error("本地数据尚未成功读取，请先重试。");
    if (saved.current === next) return;
    setSaving(true);
    try { await enqueue.current(next); saved.current = next; setLastSaved(next); setSaveFailed(false); }
    catch (e) { setSaveFailed(true); setError(e instanceof Error ? e.message : String(e || "保存失败")); throw e; }
    finally { setSaving(false); }
  };
  const flushLatest = useRef(flushSave);
  flushLatest.current = flushSave;

  useEffect(() => { void reload(); }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { document.documentElement.dataset.theme = snapshot.settings.theme === "system" ? (media.matches ? "dark" : "light") : snapshot.settings.theme; };
    apply(); media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [snapshot.settings.theme]);
  useEffect(() => {
    if (loading || loadFailed || saved.current === snapshot) return;
    const timer = window.setTimeout(() => { void flushSave().catch(() => undefined); }, 180);
    return () => window.clearTimeout(timer);
  }, [snapshot, loading, loadFailed]);
  useEffect(() => {
    if (loading || loadFailed) return;
    if (!("__TAURI_INTERNALS__" in window)) {
      const saveBeforeLeave = () => { if (saved.current !== latest.current) void saveSnapshot(latest.current).catch(() => undefined); };
      window.addEventListener("pagehide", saveBeforeLeave);
      return () => window.removeEventListener("pagehide", saveBeforeLeave);
    }
    let active = true;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      const currentWindow = getCurrentWindow();
      const stop = await currentWindow.onCloseRequested(async (event) => {
        event.preventDefault();
        if (closeInProgress.current) return;
        closeInProgress.current = true; setClosing(true);
        try { await flushLatest.current(); await currentWindow.destroy(); }
        catch (e) { setError(e instanceof Error ? e.message : String(e)); closeInProgress.current = false; setClosing(false); }
      });
      if (active) unlisten = stop; else stop();
    }).catch((e: unknown) => setError(`关闭窗口前保存未能启用：${e instanceof Error ? e.message : String(e)}`));
    return () => { active = false; unlisten?.(); };
  }, [loading, loadFailed]);

  const currentTitle = useMemo(() => navigation.find((item) => item.id === view)?.label ?? "巡礼手账", [view]);
  const update = (producer: (current: AppSnapshot) => AppSnapshot) => setSnapshot((current) => producer(current));
  const navigate = (next: ViewName, spotId?: string) => { setInitialSpotId(spotId ?? null); setView(next); };
  const common = { snapshot, update, navigate, initialSpotId };

  return <><div inert={closing} className={`app-shell ${snapshot.settings.compactNavigation ? "compact-nav" : ""}`}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><MapPinned size={23} /></div><div><strong>巡礼手账</strong><small>Junrei Journal</small></div></div>
      <nav aria-label="主导航">{navigation.map(({ id, label, icon: Icon }) => <button key={id} aria-label={label} aria-current={view === id ? "page" : undefined} className={view === id ? "active" : ""} onClick={() => navigate(id)} title={label}><Icon size={19} /><span>{label}</span></button>)}</nav>
      <div className="sidebar-foot" role="status"><span className={`save-dot ${saving || lastSaved !== snapshot ? "busy" : ""} ${saveFailed || loadFailed ? "failed" : ""}`} />{loading ? "正在读取" : loadFailed ? "读取失败" : saveFailed ? "保存失败，请重试" : saving || lastSaved !== snapshot ? "正在保存" : "已保存到本机"}</div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><p>PERSONAL PILGRIMAGE ARCHIVE</p><h1>{currentTitle}</h1></div><span className="local-badge">● 仅本地</span></header>
      {error && <div className="global-error" role="alert"><span>{error}</span>{saveFailed && <button onClick={() => void flushSave().then(() => setError("")).catch(() => undefined)}>重试保存</button>}<button onClick={() => setError("")}>关闭</button></div>}
      {loading ? <div className="loading-screen"><LoaderCircle className="spin" />正在打开你的巡礼手账…</div> : loadFailed ? <div className="loading-screen"><Database /><strong>暂时无法打开本地数据</strong><p>请重试读取，已有数据不会被覆盖。</p><button className="primary" onClick={() => void reload()}>重新读取</button></div> : <div className="view-stage">
        {view === "dashboard" && <DashboardView {...common} />}
        {view === "works" && <WorksView {...common} />}
        {view === "map" && <MapView {...common} />}
        {view === "visits" && <VisitsView {...common} />}
        {view === "gallery" && <GalleryView {...common} />}
        {view === "import" && <ImportView {...common} />}
        {view === "settings" && <SettingsView {...common} flushSave={flushSave} onReload={(next) => { saved.current = next; setLastSaved(next); setSnapshot(next); }} />}
      </div>}
    </main>
  </div>{closing && <div className="closing-screen" role="status"><LoaderCircle className="spin" />正在保存，完成后关闭…</div>}</>;
}

export interface ViewProps { snapshot: AppSnapshot; update: (producer: (current: AppSnapshot) => AppSnapshot) => void; navigate: (view: ViewName, spotId?: string) => void; initialSpotId?: string | null }
