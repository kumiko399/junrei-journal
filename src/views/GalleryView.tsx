import { useMemo, useState } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import type { ViewProps } from "../App";
import { chooseAndImportPhoto, mediaUrl } from "../lib/desktop";

export function GalleryView({ snapshot, update }: ViewProps) {
  const [spotId, setSpotId] = useState(snapshot.spots[0]?.id ?? ""); const [filter, setFilter] = useState("all"); const [busy, setBusy] = useState(false);
  const photos = useMemo(() => snapshot.photos.filter((photo) => filter === "all" || photo.spotId === filter), [snapshot.photos, filter]);
  const add = async () => { if (!spotId) return; setBusy(true); try { const photo = await chooseAndImportPhoto(spotId); if (photo) update((current) => ({ ...current, photos: [photo, ...current.photos] })); } finally { setBusy(false); } };
  const remove = (id: string) => { if (confirm("从手账中移除这张照片吗？")) update((current) => ({ ...current, photos: current.photos.filter((photo) => photo.id !== id) })); };
  return <><div className="toolbar"><div className="inline-fields"><select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">全部地点</option>{snapshot.spots.map((spot) => <option key={spot.id} value={spot.id}>{spot.name}</option>)}</select></div><div className="inline-fields"><select value={spotId} onChange={(e) => setSpotId(e.target.value)}>{snapshot.spots.length ? snapshot.spots.map((spot) => <option key={spot.id} value={spot.id}>{spot.name}</option>) : <option>请先添加地点</option>}</select><button className="primary" onClick={() => void add()} disabled={!spotId || busy}><ImagePlus size={17} />{busy ? "正在导入…" : "导入照片"}</button></div></div>
    {photos.length === 0 ? <div className="panel empty-state tall"><Camera /><strong>照片墙还是空的</strong><p>照片会复制进应用数据目录，移动原文件也不会丢失。</p></div> : <div className="gallery-grid">{photos.map((photo) => { const spot = snapshot.spots.find((item) => item.id === photo.spotId); const work = snapshot.works.find((item) => item.id === spot?.workId); return <figure key={photo.id}><img src={mediaUrl(photo)} alt={photo.caption || spot?.name || "巡礼照片"} /><figcaption><div><strong>{spot?.name ?? "未知地点"}</strong><span>{work?.titleCn}{photo.takenAt ? ` · ${photo.takenAt}` : ""}</span></div><button onClick={() => remove(photo.id)}><Trash2 size={16} /></button></figcaption></figure>; })}</div>}
  </>;
}
