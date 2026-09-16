import { ArrowRight, BookOpen, Camera, MapPin, Stamp } from "lucide-react";
import type { ViewProps } from "../App";

export function DashboardView({ snapshot, navigate }: ViewProps) {
  const visited = snapshot.spots.filter((spot) => spot.visitStatus === "visited").length;
  const recent = [...snapshot.visits].sort((a, b) => b.visitedAt.localeCompare(a.visitedAt)).slice(0, 5);
  const cards = [
    { label: "收藏作品", value: snapshot.works.length, icon: BookOpen, tone: "navy" },
    { label: "巡礼地点", value: snapshot.spots.length, icon: MapPin, tone: "coral" },
    { label: "已到访", value: visited, icon: Stamp, tone: "green" },
    { label: "私人照片", value: snapshot.photos.length, icon: Camera, tone: "sand" },
  ];
  return <div className="dashboard-grid">
    <section className="hero-card"><div><span className="eyebrow">把动画里的远方，变成自己的足迹</span><h2>今天想去<br /><em>哪一个场景？</em></h2><p>作品、坐标、照片和心情都只留在你的电脑里。</p><button className="primary" onClick={() => navigate("map")}>打开巡礼地图 <ArrowRight size={17} /></button></div><div className="hero-orbit"><MapPin /><span>35.6812° N</span><span>139.7671° E</span></div></section>
    <div className="stat-grid">{cards.map(({ label, value, icon: Icon, tone }) => <article key={label} className={`stat-card ${tone}`}><div><span>{label}</span><strong>{value}</strong></div><Icon /></article>)}</div>
    <section className="panel recent-panel"><div className="panel-title"><div><span className="eyebrow">RECENT LOG</span><h3>最近的巡礼记录</h3></div><button className="text-button" onClick={() => navigate("visits")}>查看全部 <ArrowRight size={15} /></button></div>
      {recent.length === 0 ? <div className="empty-state"><Stamp /><strong>还没有到访记录</strong><p>从地图选择一个地点，写下第一次巡礼吧。</p></div> : <div className="timeline">{recent.map((visit) => { const spot = snapshot.spots.find((item) => item.id === visit.spotId); const work = snapshot.works.find((item) => item.id === spot?.workId); return <article key={visit.id}><time>{visit.visitedAt}</time><div><strong>{spot?.name ?? "未知地点"}</strong><span>{work?.titleCn ?? "未归属作品"}{visit.weather ? ` · ${visit.weather}` : ""}</span></div><b>{visit.rating ? `${visit.rating}.0` : "—"}</b></article>; })}</div>}
    </section>
    <section className="panel progress-panel"><span className="eyebrow">JOURNEY PROGRESS</span><h3>巡礼完成度</h3><div className="progress-ring" style={{ "--progress": `${snapshot.spots.length ? visited / snapshot.spots.length * 360 : 0}deg` } as React.CSSProperties}><div><strong>{snapshot.spots.length ? Math.round(visited / snapshot.spots.length * 100) : 0}%</strong><span>{visited} / {snapshot.spots.length}</span></div></div><p>每一次抵达，都让地图多一点颜色。</p></section>
  </div>;
}
