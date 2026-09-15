import type { FeatureCollection, LineString } from "geojson";
import type { AppAPI, Plugin, RasterWindowReading } from "./host";
import "./styles.css";

const PANEL_ID = "geolibre-raster-elevation-profile-panel";
type Precision = "unit" | "decimal1" | "decimal2";

let disposePanel: (() => void) | null = null;
let manager: ProfileManager | null = null;

class ProfileManager {
  private map: any;
  private line: [number, number][] = [];
  private profile: { distance: number; elevation: number }[] = [];
  private app: AppAPI;

  constructor(app: AppAPI) { this.app = app; }

  setMap(map: any): void { this.map = map; }
  addPoint(point: [number, number]): void { this.line.push(point); this.drawLine(); }
  clear(): void { this.line = []; this.profile = []; this.removeLine(); }
  getLine(): [number, number][] { return [...this.line]; }

  async generate(layerId: string, interval: number, precision: Precision): Promise<void> {
    if (!this.app.readRasterWindow) throw new Error("This GeoLibre build does not expose readRasterWindow().");
    if (this.line.length < 2) throw new Error("Draw at least two points first.");
    const bounds = extent(this.line);
    const reading = await this.app.readRasterWindow(layerId, { bounds, width: 256, height: 256, band: 1 });
    if (!reading) throw new Error("The selected raster could not be read.");
    this.profile = sampleProfile(this.line, bounds, reading);
    if (this.profile.length < 2) throw new Error("No valid raster values intersect the line.");
    this.renderChart(interval, precision);
  }

  private drawLine(): void {
    if (!this.map) return;
    const data: FeatureCollection<LineString> = {
      type: "FeatureCollection",
      features: this.line.length < 2 ? [] : [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: this.line } }],
    };
    const source = this.map.getSource?.("raster-profile-line") as { setData(data: FeatureCollection): void } | undefined;
    if (source) source.setData(data);
    else {
      this.map.addSource("raster-profile-line", { type: "geojson", data });
      this.map.addLayer({ id: "raster-profile-line", type: "line", source: "raster-profile-line", paint: { "line-color": "#2563eb", "line-width": 3 } });
    }
  }

  private removeLine(): void {
    if (!this.map) return;
    if (this.map.getLayer?.("raster-profile-line")) this.map.removeLayer("raster-profile-line");
    if (this.map.getSource?.("raster-profile-line")) this.map.removeSource("raster-profile-line");
  }

  private renderChart(interval: number, precision: Precision): void {
    const host = document.querySelector<HTMLElement>("[data-raster-profile-chart]");
    if (!host) return;
    const width = Math.max(320, host.clientWidth || 320);
    const height = 180;
    const min = Math.min(...this.profile.map((point) => point.elevation));
    const max = Math.max(...this.profile.map((point) => point.elevation));
    const span = max - min || 1;
    const total = this.profile.at(-1)?.distance || 1;
    const points = this.profile.map((point) => [
      (point.distance / total) * width,
      height - ((point.elevation - min) / span) * (height - 20) - 10,
    ]);
    const path = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    host.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><path class="raster-profile-area" d="${path} L ${width} ${height} L 0 ${height} Z"/><path class="raster-profile-line" d="${path}"/><line class="raster-profile-hover-line" data-profile-hover-line x1="0" x2="0" y1="0" y2="${height}"/><circle class="raster-profile-hover-dot" data-profile-hover-dot r="4" cx="0" cy="0"/></svg>`;
    const svg = host.querySelector<SVGSVGElement>("svg");
    const hoverLine = host.querySelector<SVGLineElement>("[data-profile-hover-line]");
    const hoverDot = host.querySelector<SVGCircleElement>("[data-profile-hover-dot]");
    const hover = document.querySelector<HTMLElement>("[data-raster-profile-hover]");
    svg?.addEventListener("mousemove", (event) => {
      if (!svg || !hoverLine || !hoverDot) return;
      const rect = svg.getBoundingClientRect();
      const x = Math.max(0, Math.min(width, ((event.clientX - rect.left) / rect.width) * width));
      const index = Math.round((x / width) * (this.profile.length - 1));
      const point = this.profile[index];
      const y = points[index][1];
      hoverLine.setAttribute("x1", String(points[index][0]));
      hoverLine.setAttribute("x2", String(points[index][0]));
      hoverDot.setAttribute("cx", String(points[index][0]));
      hoverDot.setAttribute("cy", String(y));
      if (hover && point) hover.textContent = `${format(point.distance, "decimal1")} m · ${format(point.elevation, precision)} m`;
    });
    svg?.addEventListener("mouseleave", () => { if (hover) hover.textContent = ""; });
    const stats = document.querySelector<HTMLElement>("[data-raster-profile-stats]");
    if (stats) stats.textContent = `Min ${format(min, precision)} m · Max ${format(max, precision)} m · Δ ${format(max - min, precision)} m · Interval ${interval} m`;
  }
}

function extent(line: [number, number][]): [number, number, number, number] {
  return [Math.min(...line.map(([lng]) => lng)), Math.min(...line.map(([, lat]) => lat)), Math.max(...line.map(([lng]) => lng)), Math.max(...line.map(([, lat]) => lat))];
}

function sampleProfile(line: [number, number][], bounds: [number, number, number, number], reading: RasterWindowReading): { distance: number; elevation: number }[] {
  const distances = cumulativeDistances(line);
  const total = distances.at(-1) ?? 0;
  const samples = Math.max(64, Math.min(256, reading.width));
  const profile: { distance: number; elevation: number }[] = [];
  let segment = 1;
  for (let sample = 0; sample < samples; sample += 1) {
    const distance = (total * sample) / (samples - 1);
    while (segment < distances.length - 1 && distances[segment] < distance) segment += 1;
    const startDistance = distances[segment - 1];
    const endDistance = distances[segment];
    const ratio = endDistance === startDistance ? 0 : (distance - startDistance) / (endDistance - startDistance);
    const point: [number, number] = [
      line[segment - 1][0] + (line[segment][0] - line[segment - 1][0]) * ratio,
      line[segment - 1][1] + (line[segment][1] - line[segment - 1][1]) * ratio,
    ];
    const x = Math.max(0, Math.min(reading.width - 1, ((point[0] - bounds[0]) / (bounds[2] - bounds[0])) * reading.width));
    const y = Math.max(0, Math.min(reading.height - 1, ((bounds[3] - point[1]) / (bounds[3] - bounds[1])) * reading.height));
    const value = reading.values[Math.floor(y) * reading.width + Math.floor(x)];
    if (Number.isFinite(value)) profile.push({ distance, elevation: value });
  }
  return profile;
}

function cumulativeDistances(line: [number, number][]): number[] {
  const values = [0];
  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1], b = line[i];
    const lat = ((a[1] + b[1]) / 2) * Math.PI / 180;
    const dx = (b[0] - a[0]) * Math.cos(lat) * 111320;
    const dy = (b[1] - a[1]) * 110540;
    values.push(values[i - 1] + Math.hypot(dx, dy));
  }
  return values;
}

function format(value: number, precision: Precision): string {
  const digits = precision === "unit" ? 0 : precision === "decimal1" ? 1 : 2;
  return value.toFixed(digits);
}

export const plugin: Plugin = {
  id: "geolibre-raster-elevation-profile",
  name: "Raster Elevation Profile",
  version: "0.1.0",
  engines: ["maplibre"],
  activate(app) {
    manager = new ProfileManager(app);
    disposePanel = app.registerRightPanel?.({
      id: PANEL_ID,
      title: "Raster Elevation Profile",
      dock: "replace-style",
      defaultWidth: 380,
      render(container) {
        manager?.setMap(app.getMap?.());
        container.innerHTML = `<div class="raster-profile-panel"><h3>Raster Elevation Profile</h3><div class="raster-profile-section"><label class="raster-profile-label">Raster layer</label><select class="raster-profile-select" data-raster-profile-layer></select><label class="raster-profile-label">Precision</label><select class="raster-profile-select" data-raster-profile-precision><option value="unit">0 decimals</option><option value="decimal1">1 decimal</option><option value="decimal2">2 decimals</option></select><div class="raster-profile-buttons"><button class="raster-profile-button primary" data-raster-profile-draw>Draw line</button><button class="raster-profile-button" data-raster-profile-finish>Apply profile</button><button class="raster-profile-button" data-raster-profile-clear>Clear</button></div><div class="raster-profile-status" data-raster-profile-status></div></div><div class="raster-profile-stats" data-raster-profile-stats></div><div class="raster-profile-hover" data-raster-profile-hover></div><div class="raster-profile-chart" data-raster-profile-chart></div></div>`;
        const layerSelect = container.querySelector<HTMLSelectElement>('[data-raster-profile-layer]')!;
        for (const layer of app.listLayers?.().filter((item) => /cog|raster/i.test(item.type)) ?? []) { const option = document.createElement("option"); option.value = layer.id; option.textContent = layer.name; layerSelect.appendChild(option); }
        const status = container.querySelector<HTMLElement>('[data-raster-profile-status]')!;
        const precision = container.querySelector<HTMLSelectElement>('[data-raster-profile-precision]')!;
        const setStatus = (text: string) => { status.textContent = text; };
        container.querySelector('[data-raster-profile-draw]')?.addEventListener('click', () => setStatus('Click points on the map, then click Apply profile.'));
        const map = app.getMap?.();
        let drawing = false;
        const click = (event: any) => { if (drawing) manager?.addPoint([event.lngLat.lng, event.lngLat.lat]); };
        container.querySelector('[data-raster-profile-draw]')?.addEventListener('click', () => { drawing = true; map?.on('click', click); });
        container.querySelector('[data-raster-profile-finish]')?.addEventListener('click', async () => { drawing = false; map?.off('click', click); try { setStatus('Reading raster window...'); await manager?.generate(layerSelect.value, 1, precision.value as Precision); setStatus('Profile updated.'); } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); } });
        container.querySelector('[data-raster-profile-clear]')?.addEventListener('click', () => { drawing = false; map?.off('click', click); manager?.clear(); container.querySelector<HTMLElement>('[data-raster-profile-chart]')!.textContent = ''; container.querySelector<HTMLElement>('[data-raster-profile-stats]')!.textContent = ''; });
        return () => map?.off('click', click);
      },
    }) ?? null;
    app.openRightPanel?.(PANEL_ID);
  },
  deactivate(app) { app.closeRightPanel?.(PANEL_ID); disposePanel?.(); disposePanel = null; manager?.clear(); manager = null; },
};

export default plugin;
