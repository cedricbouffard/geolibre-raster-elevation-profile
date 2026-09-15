import type { Map as MapLibreMap } from "maplibre-gl";

export interface RasterWindowOptions {
  bounds: [number, number, number, number];
  width?: number;
  height?: number;
  band?: number;
  signal?: AbortSignal;
}

export interface RasterWindowReading {
  values: number[];
  width: number;
  height: number;
  band: number;
  nodata: number | null;
  overviewLevel: number;
}

export interface LayerSummary {
  id: string;
  name: string;
  type: string;
}

export interface AppAPI {
  getMap?: () => MapLibreMap | null;
  listLayers?: () => LayerSummary[];
  getViewBounds?: () => [number, number, number, number] | null;
  readRasterWindow?: (layerId: string, options: RasterWindowOptions) => Promise<RasterWindowReading | null>;
  registerRightPanel?: (panel: {
    id: string;
    title: string | (() => string);
    dock?: string;
    defaultWidth?: number;
    render: (container: HTMLElement) => void | (() => void);
  }) => () => void;
  unregisterRightPanel?: (id: string) => void;
  openRightPanel?: (id: string) => boolean;
  closeRightPanel?: (id: string) => void;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  engines?: ("maplibre" | "cesium")[];
  activate: (app: AppAPI) => void | boolean;
  deactivate: (app: AppAPI) => void;
}
