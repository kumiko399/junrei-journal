import { useEffect, useRef } from "react";
import type { MapProvider, Spot } from "../types";
import { createMapAdapter, type Coordinate, type MapAdapter, type MapViewState } from "../lib/map-adapter";

interface Props {
  provider: MapProvider;
  tileUrl: string;
  tileAttribution?: string;
  tileAttributionUrl?: string;
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
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    if (!node.current) return;
    let active = true;
    const instance = createMapAdapter(props.provider); adapter.current = instance;
    void instance.mount(node.current, { center: props.view.center, zoom: props.view.zoom, tileUrl: props.tileUrl, tileAttribution: props.tileAttribution, tileAttributionUrl: props.tileAttributionUrl, googleApiKey: props.googleApiKey,
      onSpotSelect: (id) => { if (active) latest.current.onSelect(id); },
      onCoordinatePick: (coordinate) => { if (active) latest.current.onPick(coordinate); },
      onViewChange: (view) => { if (active) latest.current.onViewChange(view); },
      onError: (message) => { if (active) latest.current.onProviderError(message); },
    }).then(() => {
      if (!active) return;
      instance.setSpots(latest.current.spots); instance.enableCoordinatePicker(latest.current.picking);
      if (latest.current.selectedId) instance.focusSpot(latest.current.selectedId);
    }).catch((error: unknown) => { if (active) latest.current.onProviderError(error instanceof Error ? error.message : "地图加载失败"); });
    return () => { active = false; instance.destroy(); if (adapter.current === instance) adapter.current = null; };
  }, [props.provider, props.tileUrl, props.tileAttribution, props.tileAttributionUrl, props.googleApiKey]);
  useEffect(() => adapter.current?.setSpots(props.spots), [props.spots]);
  useEffect(() => adapter.current?.enableCoordinatePicker(props.picking), [props.picking]);
  useEffect(() => { if (props.selectedId) adapter.current?.focusSpot(props.selectedId); }, [props.selectedId]);
  return <div ref={node} className="map-canvas" aria-label="圣地巡礼地图" />;
}
