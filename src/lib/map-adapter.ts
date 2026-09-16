import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import type { MapProvider, Spot } from "../types";

export interface Coordinate { latitude: number; longitude: number }
export interface MapViewState { center: Coordinate; zoom: number }
export interface MapOptions {
  center: Coordinate;
  zoom: number;
  tileUrl: string;
  googleApiKey?: string;
  onSpotSelect: (spotId: string) => void;
  onCoordinatePick: (coordinate: Coordinate) => void;
  onViewChange: (view: MapViewState) => void;
  onError: (message: string) => void;
}

export interface MapAdapter {
  mount(container: HTMLElement, options: MapOptions): Promise<void>;
  setView(center: Coordinate, zoom: number): void;
  getView(): MapViewState;
  setSpots(spots: Spot[]): void;
  focusSpot(spotId: string): void;
  enableCoordinatePicker(enabled: boolean): void;
  destroy(): void;
}

type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; status: string }>;

export class OpenMapAdapter implements MapAdapter {
  private map?: MapLibreMap;
  private spots: Spot[] = [];
  private picker = false;
  private options?: MapOptions;

  async mount(container: HTMLElement, options: MapOptions) {
    this.options = options;
    this.map = new maplibregl.Map({
      container,
      center: [options.center.longitude, options.center.latitude],
      zoom: options.zoom,
      attributionControl: { compact: true },
      style: {
        version: 8,
        sources: { openstreetmap: { type: "raster", tiles: [options.tileUrl], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
        layers: [{ id: "openstreetmap", type: "raster", source: "openstreetmap" }],
      },
    });
    this.map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    await new Promise<void>((resolve, reject) => {
      this.map?.once("load", () => resolve());
      this.map?.once("error", (event) => reject(event.error));
    });
    const map = this.map;
    map.addSource("spots", { type: "geojson", data: this.featureCollection(), cluster: true, clusterMaxZoom: 13, clusterRadius: 48 });
    map.addLayer({ id: "clusters", type: "circle", source: "spots", filter: ["has", "point_count"], paint: { "circle-color": "#173b5b", "circle-radius": ["step", ["get", "point_count"], 19, 10, 24, 30, 30], "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
    map.addLayer({ id: "cluster-count", type: "symbol", source: "spots", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 13 }, paint: { "text-color": "#fff" } });
    map.addLayer({ id: "spot-points", type: "circle", source: "spots", filter: ["!", ["has", "point_count"]], paint: { "circle-color": ["match", ["get", "status"], "visited", "#16836f", "planned", "#e76f51", "skipped", "#8b95a1", "#fff"], "circle-radius": 13, "circle-stroke-color": "#173b5b", "circle-stroke-width": 2 } });
    map.addLayer({ id: "spot-symbols", type: "symbol", source: "spots", filter: ["!", ["has", "point_count"]], layout: { "text-field": ["match", ["get", "status"], "visited", "✓", "planned", "☆", "skipped", "–", "○"], "text-size": 14, "text-allow-overlap": true }, paint: { "text-color": ["match", ["get", "status"], "unvisited", "#173b5b", "#fff"] } });
    for (const layer of ["spot-points", "spot-symbols"]) map.on("click", layer, (event) => options.onSpotSelect(String(event.features?.[0]?.properties?.id ?? "")));
    map.on("click", "clusters", async (event) => {
      const feature = map.queryRenderedFeatures(event.point, { layers: ["clusters"] })[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const zoom = await (map.getSource("spots") as GeoJSONSource).getClusterExpansionZoom(Number(feature.properties?.cluster_id));
      map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom });
    });
    map.on("click", (event) => { if (this.picker) options.onCoordinatePick({ latitude: event.lngLat.lat, longitude: event.lngLat.lng }); });
    map.on("moveend", () => { const center = map.getCenter(); options.onViewChange({ center: { latitude: center.lat, longitude: center.lng }, zoom: map.getZoom() }); });
    this.setSpots(this.spots);
  }

  private featureCollection(): FeatureCollection {
    return { type: "FeatureCollection", features: this.spots.map((spot) => ({ type: "Feature", geometry: { type: "Point", coordinates: [spot.longitude, spot.latitude] }, properties: { id: spot.id, status: spot.visitStatus } })) };
  }
  setSpots(spots: Spot[]) { this.spots = spots; const source = this.map?.getSource("spots") as GeoJSONSource | undefined; source?.setData(this.featureCollection()); }
  setView(center: Coordinate, zoom: number) { this.map?.jumpTo({ center: [center.longitude, center.latitude], zoom }); }
  getView(): MapViewState { const center = this.map?.getCenter(); return { center: center ? { latitude: center.lat, longitude: center.lng } : { latitude: 36.2, longitude: 137.2 }, zoom: this.map?.getZoom() ?? 4.25 }; }
  focusSpot(id: string) { const spot = this.spots.find((item) => item.id === id); if (spot) this.map?.flyTo({ center: [spot.longitude, spot.latitude], zoom: Math.max(this.map.getZoom(), 13) }); }
  enableCoordinatePicker(enabled: boolean) { this.picker = enabled; if (this.map) this.map.getCanvas().style.cursor = enabled ? "crosshair" : ""; }
  destroy() { this.map?.remove(); this.map = undefined; }
}

declare global { interface Window { google?: { maps: any }; __junreiGoogleReady?: () => void } }

let googlePromise: Promise<void> | null = null;
function loadGoogle(apiKey: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (googlePromise) return googlePromise;
  googlePromise = new Promise((resolve, reject) => {
    window.__junreiGoogleReady = resolve;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=__junreiGoogleReady&v=weekly`;
    script.async = true; script.onerror = () => reject(new Error("Google Maps 脚本加载失败")); document.head.append(script);
  });
  return googlePromise;
}

export class GoogleMapAdapter implements MapAdapter {
  private map: any;
  private markers: any[] = [];
  private spots: Spot[] = [];
  private picker = false;
  private options?: MapOptions;
  async mount(container: HTMLElement, options: MapOptions) {
    if (!options.googleApiKey) throw new Error("请先在设置中填写 Google Maps API Key");
    this.options = options;
    await loadGoogle(options.googleApiKey);
    const maps = window.google!.maps;
    this.map = new maps.Map(container, { center: { lat: options.center.latitude, lng: options.center.longitude }, zoom: options.zoom, mapTypeControl: true, streetViewControl: false, fullscreenControl: false });
    this.map.addListener("click", (event: any) => { if (this.picker && event.latLng) options.onCoordinatePick({ latitude: event.latLng.lat(), longitude: event.latLng.lng() }); });
    this.map.addListener("idle", () => { const center = this.map.getCenter(); options.onViewChange({ center: { latitude: center.lat(), longitude: center.lng() }, zoom: this.map.getZoom() }); });
    this.setSpots(this.spots);
  }
  setSpots(spots: Spot[]) {
    this.spots = spots; this.markers.forEach((marker) => marker.setMap(null)); this.markers = [];
    if (!this.map || !window.google) return;
    const maps = window.google.maps;
    this.markers = spots.map((spot) => {
      const marker = new maps.Marker({ map: this.map, position: { lat: spot.latitude, lng: spot.longitude }, title: spot.name, label: { text: spot.visitStatus === "visited" ? "✓" : spot.visitStatus === "planned" ? "☆" : "○", color: spot.visitStatus === "unvisited" ? "#173b5b" : "#fff" } });
      marker.addListener("click", () => this.options?.onSpotSelect(spot.id)); return marker;
    });
  }
  setView(center: Coordinate, zoom: number) { this.map?.setCenter({ lat: center.latitude, lng: center.longitude }); this.map?.setZoom(zoom); }
  getView(): MapViewState { const center = this.map?.getCenter(); return { center: center ? { latitude: center.lat(), longitude: center.lng() } : { latitude: 36.2, longitude: 137.2 }, zoom: this.map?.getZoom() ?? 4.25 }; }
  focusSpot(id: string) { const spot = this.spots.find((item) => item.id === id); if (spot) { this.map?.panTo({ lat: spot.latitude, lng: spot.longitude }); this.map?.setZoom(Math.max(this.map.getZoom(), 13)); } }
  enableCoordinatePicker(enabled: boolean) { this.picker = enabled; this.map?.setOptions({ draggableCursor: enabled ? "crosshair" : undefined }); }
  destroy() { this.markers.forEach((marker) => marker.setMap(null)); this.markers = []; this.map = undefined; }
}

export const createMapAdapter = (provider: MapProvider): MapAdapter => provider === "google" ? new GoogleMapAdapter() : new OpenMapAdapter();
