import type { AnitabiPreview, AppSnapshot, AnimeWork } from "../types";
import { newId, nowIso } from "../types";

export const normalizeTitle = (value: string) => value.trim().normalize("NFKC").toLocaleLowerCase();
export function formatSceneTime(totalSeconds: number): string { const seconds = Math.max(0, Math.floor(totalSeconds)); const minutes = Math.floor(seconds / 60); return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }

export function importAnitabiPreview(snapshot: AppSnapshot, preview: AnitabiPreview, selectedPointIds: Set<string>) {
  const timestamp = nowIso(); const existingWork = snapshot.works.find((work) => work.anitabiBangumiId === preview.id);
  const work: AnimeWork = existingWork ? { ...existingWork, titleCn: preview.cn || existingWork.titleCn, titleOriginal: preview.title ?? existingWork.titleOriginal, coverUrl: preview.cover ?? existingWork.coverUrl, city: preview.city ?? existingWork.city, updatedAt: timestamp } : { id: newId(), titleCn: preview.cn || preview.title || `Bangumi ${preview.id}`, titleOriginal: preview.title, coverUrl: preview.cover, city: preview.city, anitabiBangumiId: preview.id, status: "not_started", createdAt: timestamp, updatedAt: timestamp };
  const works = existingWork ? snapshot.works.map((item) => item.id === work.id ? work : item) : [...snapshot.works, work]; let added = 0; let updated = 0; const spots = [...snapshot.spots];
  for (const point of preview.points.filter((item) => selectedPointIds.has(item.id))) {
    const current = spots.find((spot) => spot.workId === work.id && spot.anitabiPointId === point.id); const referenceImageUrl = point.image?.replace("plan=h160", "plan=h360") ?? null;
    if (current) { const index = spots.indexOf(current); spots[index] = { ...current, name: point.name || current.name, latitude: point.geo[0], longitude: point.geo[1], episode: point.ep == null ? current.episode : String(point.ep), sceneTimestamp: point.s == null ? current.sceneTimestamp : formatSceneTime(point.s), referenceImageUrl, referenceOrigin: point.origin ?? current.referenceOrigin, referenceOriginUrl: point.originURL ?? current.referenceOriginUrl, updatedAt: timestamp }; updated += 1; }
    else { spots.push({ id: newId(), workId: work.id, name: point.name || "未命名地点", city: preview.city, latitude: point.geo[0], longitude: point.geo[1], episode: point.ep == null ? null : String(point.ep), sceneTimestamp: point.s == null ? null : formatSceneTime(point.s), visitStatus: "unvisited", anitabiPointId: point.id, referenceImageUrl, referenceOrigin: point.origin, referenceOriginUrl: point.originURL, sourceUrl: `https://anitabi.cn/map?bangumiId=${preview.id}`, createdAt: timestamp, updatedAt: timestamp }); added += 1; }
  }
  return { snapshot: { ...snapshot, works, spots }, workId: work.id, added, updated };
}

export function mergeLegacySnapshot(current: AppSnapshot, incoming: AppSnapshot): AppSnapshot {
  const works = [...current.works]; const workMap = new Map<string, string>();
  for (const source of incoming.works) { const target = works.find((work) => source.anitabiBangumiId != null && work.anitabiBangumiId === source.anitabiBangumiId) ?? works.find((work) => normalizeTitle(work.titleCn) === normalizeTitle(source.titleCn)); if (target) workMap.set(source.id, target.id); else { const id = newId(); works.push({ ...source, id }); workMap.set(source.id, id); } }
  const spots = [...current.spots]; const spotMap = new Map<string, string>();
  for (const source of incoming.spots) { const workId = workMap.get(source.workId); if (!workId) continue; const target = spots.find((spot) => spot.workId === workId && source.anitabiPointId && spot.anitabiPointId === source.anitabiPointId) ?? spots.find((spot) => spot.workId === workId && normalizeTitle(spot.name) === normalizeTitle(source.name) && Math.abs(spot.latitude - source.latitude) < .00001 && Math.abs(spot.longitude - source.longitude) < .00001); if (target) spotMap.set(source.id, target.id); else { const id = newId(); spots.push({ ...source, id, workId }); spotMap.set(source.id, id); } }
  const visits = [...current.visits]; const visitMap = new Map<string, string>();
  for (const source of incoming.visits) { const spotId = spotMap.get(source.spotId); if (!spotId) continue; const target = visits.find((visit) => visit.spotId === spotId && visit.visitedAt === source.visitedAt && (visit.note ?? "") === (source.note ?? "")); if (target) visitMap.set(source.id, target.id); else { const id = newId(); visits.push({ ...source, id, spotId }); visitMap.set(source.id, id); } }
  const photos = [...current.photos];
  for (const source of incoming.photos) { const spotId = spotMap.get(source.spotId); if (!spotId || (source.sha256 && photos.some((photo) => photo.sha256 === source.sha256))) continue; photos.push({ ...source, id: newId(), spotId, visitId: source.visitId ? visitMap.get(source.visitId) ?? null : null }); }
  return { ...current, works, spots, visits, photos };
}
