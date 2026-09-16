import { useEffect, useRef } from "react";
import type { MapProvider, Spot } from "../types";
import { createMapAdapter, type Coordinate, type MapAdapter, type MapViewState } from "../lib/map-adapter";

interface Props {
  provider: MapProvider;
  tileUrl: string;
  googleApiKey: string;
  spots: Spot[];
  selectedId?: string | null;
  picking: boolean;
  view: MapViewState;
  onViewChange: (view: MapViewState) => void;
  onSelect: (id: string) => void;
  onPick: (coordinate: Coordinate) => void;
  onProviderError: (message: string) => void;
}

export function MapCanvas(props: Props) {
  const node = useRef<HTMLDivElement>(null);
  const adapter = useRef<MapAdapter | null>(null);
  useEffect(() => {
    if (!node.current) return;
    const instance = createMapAdapter(props.provider); adapter.current = instance;
    void instance.mount(node.current, { center: props.view.center, zoom: props.view.zoom, tileUrl: props.tileUrl, googleApiKey: props.googleApiKey, onSpotSelect: props.onSelect, onCoordinatePick: props.onPick, onViewChange: props.onViewChange, onError: props.onProviderError })
      .catch((error: unknown) => props.onProviderError(error instanceof Error ? error.message : "地图加载失败"));
    return () => { instance.destroy(); if (adapter.current === instance) adapter.current = null; };
  }, [props.provider, props.tileUrl, props.googleApiKey]);
  useEffect(() => adapter.current?.setSpots(props.spots), [props.spots]);
  useEffect(() => adapter.current?.enableCoordinatePicker(props.picking), [props.picking]);
  useEffect(() => { if (props.selectedId) adapter.current?.focusSpot(props.selectedId); }, [props.selectedId]);
  return <div ref={node} className="map-canvas" aria-label="圣地巡礼地图" />;
}
