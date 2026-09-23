export type WorkStatus = "not_started" | "in_progress" | "completed" | "archived";
export type SpotStatus = "unvisited" | "planned" | "visited" | "skipped";
export type MapProvider = "open" | "google";

export interface AnimeWork {
  id: string;
  legacyId?: string | null;
  titleCn: string;
  titleOriginal?: string | null;
  coverUrl?: string | null;
  anitabiBangumiId?: number | null;
  releaseYear?: number | null;
  city?: string | null;
  description?: string | null;
  personalNote?: string | null;
  status: WorkStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Spot {
  id: string;
  legacyId?: string | null;
  workId: string;
  name: string;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  address?: string | null;
  latitude: number;
  longitude: number;
  episode?: string | null;
  sceneTimestamp?: string | null;
  sceneDescription?: string | null;
  transportNote?: string | null;
  visitStatus: SpotStatus;
  sourceUrl?: string | null;
  anitabiPointId?: string | null;
  referenceImageUrl?: string | null;
  referenceOrigin?: string | null;
  referenceOriginUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Visit {
  id: string;
  legacyId?: string | null;
  spotId: string;
  visitedAt: string;
  visitedTime?: string | null;
  note?: string | null;
  weather?: string | null;
  companions?: string | null;
  rating?: number | null;
  matchedAngle: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  id: string;
  legacyId?: string | null;
  spotId: string;
  visitId?: string | null;
  relativePath: string;
  thumbnailPath?: string | null;
  fileUrl?: string | null;
  sha256?: string | null;
  photoType: "reference" | "visit" | "environment";
  caption?: string | null;
  takenAt?: string | null;
  sortOrder: number;
  isCover: boolean;
  width?: number | null;
  height?: number | null;
  createdAt: string;
}

export interface Tag { id: string; name: string }
export interface SpotTag { spotId: string; tagId: string }

export interface AppSettings {
  mapProvider: MapProvider;
  mapStyleUrl: string;
  mapAttribution?: string;
  mapAttributionUrl?: string;
  theme: "light" | "dark" | "system";
  compactNavigation: boolean;
}

export interface AppSnapshot {
  schemaVersion: 1;
  works: AnimeWork[];
  spots: Spot[];
  visits: Visit[];
  photos: Photo[];
  tags: Tag[];
  spotTags: SpotTag[];
  settings: AppSettings;
}

export interface AnitabiPoint {
  id: string;
  name: string;
  image?: string | null;
  ep?: string | number | null;
  s?: number | null;
  geo: [number, number];
  origin?: string | null;
  originURL?: string | null;
}

export interface AnitabiPreview {
  id: number;
  cn: string;
  title?: string | null;
  city?: string | null;
  cover?: string | null;
  modified?: number | string | null;
  points: AnitabiPoint[];
}

export const emptySnapshot = (): AppSnapshot => ({
  schemaVersion: 1,
  works: [], spots: [], visits: [], photos: [], tags: [], spotTags: [],
  settings: {
    mapProvider: "open",
    mapStyleUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    mapAttribution: "© OpenStreetMap contributors",
    mapAttributionUrl: "https://www.openstreetmap.org/copyright",
    theme: "light",
    compactNavigation: false,
  },
});

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
