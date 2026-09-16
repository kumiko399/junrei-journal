import { useEffect, useMemo, useState } from "react";
import { BookOpen, Camera, Database, Home, LoaderCircle, Map, MapPinned, Settings, Stamp } from "lucide-react";
import type { AppSnapshot } from "./types";
import { emptySnapshot } from "./types";
import { loadSnapshot, saveSnapshot } from "./lib/desktop";
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void loadSnapshot().then(setSnapshot).catch((e: unknown) => setError(e instanceof Error ? e.message : "无法读取本地数据")).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = snapshot.settings.theme;
    if (loading) return;
    const timer = window.setTimeout(() => { setSaving(true); void saveSnapshot(snapshot).catch((e: unknown) => setError(e instanceof Error ? e.message : "保存失败")).finally(() => setSaving(false)); }, 180);
    return () => window.clearTimeout(timer);
  }, [snapshot, loading]);

  const currentTitle = useMemo(() => navigation.find((item) => item.id === view)?.label ?? "巡礼手账", [view]);
  const update = (producer: (current: AppSnapshot) => AppSnapshot) => setSnapshot((current) => producer(current));
  const common = { snapshot, update, navigate: setView };

  return <div className={`app-shell ${snapshot.settings.compactNavigation ? "compact-nav" : ""}`}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><MapPinned size={23} /></div><div><strong>巡礼手账</strong><small>Junrei Journal</small></div></div>
      <nav>{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)} title={label}><Icon size={19} /><span>{label}</span></button>)}</nav>
      <div className="sidebar-foot"><span className={`save-dot ${saving ? "busy" : ""}`} />{saving ? "正在保存" : "已保存到本机"}</div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><p>PERSONAL PILGRIMAGE ARCHIVE</p><h1>{currentTitle}</h1></div><span className="local-badge">● 仅本地</span></header>
      {error && <div className="global-error" role="alert">{error}<button onClick={() => setError("")}>关闭</button></div>}
      {loading ? <div className="loading-screen"><LoaderCircle className="spin" />正在打开你的巡礼手账…</div> : <div className="view-stage">
        {view === "dashboard" && <DashboardView {...common} />}
        {view === "works" && <WorksView {...common} />}
        {view === "map" && <MapView {...common} />}
        {view === "visits" && <VisitsView {...common} />}
        {view === "gallery" && <GalleryView {...common} />}
        {view === "import" && <ImportView {...common} />}
        {view === "settings" && <SettingsView {...common} onReload={(next) => setSnapshot(next)} />}
      </div>}
    </main>
  </div>;
}

export interface ViewProps { snapshot: AppSnapshot; update: (producer: (current: AppSnapshot) => AppSnapshot) => void; navigate: (view: ViewName) => void }
