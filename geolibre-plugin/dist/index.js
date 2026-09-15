var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const PANEL_ID = "geolibre-raster-elevation-profile-panel";
let disposePanel = null;
let manager = null;
class ProfileManager {
  constructor(app) {
    __publicField(this, "map");
    __publicField(this, "line", []);
    __publicField(this, "profile", []);
    __publicField(this, "app");
    this.app = app;
  }
  setMap(map) {
    this.map = map;
  }
  addPoint(point) {
    this.line.push(point);
    this.drawLine();
  }
  clear() {
    this.line = [];
    this.profile = [];
    this.removeLine();
  }
  getLine() {
    return [...this.line];
  }
  setHoverPoint(coord) {
    var _a, _b;
    if (!this.map) return;
    const data = coord ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: coord } }] } : { type: "FeatureCollection", features: [] };
    const source = (_b = (_a = this.map).getSource) == null ? void 0 : _b.call(_a, "raster-profile-hover-point");
    if (source) source.setData(data);
    else {
      this.map.addSource("raster-profile-hover-point", { type: "geojson", data });
      this.map.addLayer({ id: "raster-profile-hover-point", type: "circle", source: "raster-profile-hover-point", paint: { "circle-radius": 6, "circle-color": "#ef4444", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
    }
  }
  async generate(layerId, interval, precision) {
    if (!this.app.readRasterWindow) throw new Error("This GeoLibre build does not expose readRasterWindow().");
    if (this.line.length < 2) throw new Error("Draw at least two points first.");
    const bounds = extent(this.line);
    const reading = await this.app.readRasterWindow(layerId, { bounds, width: 128, height: 128, band: 1 });
    if (!reading) throw new Error("The selected raster could not be read.");
    this.profile = sampleProfile(this.line, bounds, reading);
    if (this.profile.length < 2) throw new Error("No valid raster values intersect the line.");
    this.renderChart(interval, precision);
  }
  drawLine() {
    var _a, _b;
    if (!this.map) return;
    const data = {
      type: "FeatureCollection",
      features: this.line.length < 2 ? [] : [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: this.line } }]
    };
    const source = (_b = (_a = this.map).getSource) == null ? void 0 : _b.call(_a, "raster-profile-line");
    if (source) source.setData(data);
    else {
      this.map.addSource("raster-profile-line", { type: "geojson", data });
      this.map.addLayer({ id: "raster-profile-line", type: "line", source: "raster-profile-line", paint: { "line-color": "#2563eb", "line-width": 3 } });
    }
  }
  removeLine() {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (!this.map) return;
    if ((_b = (_a = this.map).getLayer) == null ? void 0 : _b.call(_a, "raster-profile-line")) this.map.removeLayer("raster-profile-line");
    if ((_d = (_c = this.map).getSource) == null ? void 0 : _d.call(_c, "raster-profile-line")) this.map.removeSource("raster-profile-line");
    if ((_f = (_e = this.map).getLayer) == null ? void 0 : _f.call(_e, "raster-profile-hover-point")) this.map.removeLayer("raster-profile-hover-point");
    if ((_h = (_g = this.map).getSource) == null ? void 0 : _h.call(_g, "raster-profile-hover-point")) this.map.removeSource("raster-profile-hover-point");
  }
  renderChart(interval, precision) {
    var _a;
    const host = document.querySelector("[data-raster-profile-chart]");
    if (!host) return;
    const width = Math.max(320, host.clientWidth || 320);
    const height = 210;
    const padding = { left: 48, right: 10, top: 10, bottom: 28 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const min = Math.min(...this.profile.map((point) => point.elevation));
    const max = Math.max(...this.profile.map((point) => point.elevation));
    const span = max - min || 1;
    const total = ((_a = this.profile.at(-1)) == null ? void 0 : _a.distance) || 1;
    const trend = linearTrend(this.profile);
    const points = this.profile.map((point) => [
      padding.left + point.distance / total * plotWidth,
      padding.top + (1 - (point.elevation - min) / span) * plotHeight
    ]);
    const path = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    const trendStart = trend.intercept;
    const trendEnd = trend.intercept + trend.slope * total;
    const trendPath = `M${padding.left.toFixed(1)} ${(padding.top + (1 - (trendStart - min) / span) * plotHeight).toFixed(1)} L${(padding.left + plotWidth).toFixed(1)} ${(padding.top + (1 - (trendEnd - min) / span) * plotHeight).toFixed(1)}`;
    const axisBottom = padding.top + plotHeight;
    const axisLeft = padding.left;
    const xLabelY = height - 7;
    const grid = Array.from({ length: 5 }, (_, index) => {
      const x = axisLeft + index / 4 * plotWidth;
      const y = padding.top + index / 4 * plotHeight;
      return `<line class="raster-profile-grid" x1="${x}" y1="${padding.top}" x2="${x}" y2="${axisBottom}"/><line class="raster-profile-grid" x1="${axisLeft}" y1="${y}" x2="${axisLeft + plotWidth}" y2="${y}"/>`;
    }).join("");
    host.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${grid}<path class="raster-profile-area" d="${path} L ${axisLeft + plotWidth} ${axisBottom} L ${axisLeft} ${axisBottom} Z"/><path class="raster-profile-line" d="${path}"/><path class="raster-profile-trend" d="${trendPath}"/><line class="raster-profile-axis" x1="${axisLeft}" y1="${axisBottom}" x2="${axisLeft + plotWidth}" y2="${axisBottom}"/><line class="raster-profile-axis" x1="${axisLeft}" y1="${padding.top}" x2="${axisLeft}" y2="${axisBottom}"/><text class="raster-profile-axis-label" x="${axisLeft - 6}" y="${padding.top + 4}" text-anchor="end">${format(max, precision)} m</text><text class="raster-profile-axis-label" x="${axisLeft - 6}" y="${axisBottom}" text-anchor="end">${format(min, precision)} m</text><text class="raster-profile-axis-label" x="${axisLeft}" y="${xLabelY}" text-anchor="start">0 m</text><text class="raster-profile-axis-label" x="${axisLeft + plotWidth}" y="${xLabelY}" text-anchor="end">${format(total, "decimal1")} m</text><line class="raster-profile-hover-line" data-profile-hover-line x1="0" x2="0" y1="${padding.top}" y2="${axisBottom}"/><circle class="raster-profile-hover-dot" data-profile-hover-dot r="4" cx="0" cy="0"/></svg>`;
    const svg = host.querySelector("svg");
    const hoverLine = host.querySelector("[data-profile-hover-line]");
    const hoverDot = host.querySelector("[data-profile-hover-dot]");
    const hover = document.querySelector("[data-raster-profile-hover]");
    svg == null ? void 0 : svg.addEventListener("mousemove", (event) => {
      if (!svg || !hoverLine || !hoverDot) return;
      const rect = svg.getBoundingClientRect();
      const x = Math.max(0, Math.min(width, (event.clientX - rect.left) / rect.width * width));
      const index = Math.round(x / width * (this.profile.length - 1));
      const point = this.profile[index];
      const y = points[index][1];
      hoverLine.setAttribute("x1", String(points[index][0]));
      hoverLine.setAttribute("x2", String(points[index][0]));
      hoverDot.setAttribute("cx", String(points[index][0]));
      hoverDot.setAttribute("cy", String(y));
      if (point) this.setHoverPoint(point.coord);
      if (hover && point) hover.textContent = `${format(point.distance, "decimal1")} m · ${format(point.elevation, precision)} m`;
    });
    svg == null ? void 0 : svg.addEventListener("mouseleave", () => {
      this.setHoverPoint(null);
      if (hover) hover.textContent = "";
    });
    const stats = document.querySelector("[data-raster-profile-stats]");
    if (stats) stats.textContent = `Min ${format(min, precision)} m · Max ${format(max, precision)} m · Δ ${format(max - min, precision)} m · Trend ${formatSignedPercent(trend.slope * 100)} · Interval ${interval} m`;
  }
}
function extent(line) {
  return [Math.min(...line.map(([lng]) => lng)), Math.min(...line.map(([, lat]) => lat)), Math.max(...line.map(([lng]) => lng)), Math.max(...line.map(([, lat]) => lat))];
}
function sampleProfile(line, bounds, reading) {
  const distances = cumulativeDistances(line);
  const total = distances.at(-1) ?? 0;
  const samples = Math.max(64, Math.min(128, reading.width));
  const profile = [];
  let segment = 1;
  for (let sample = 0; sample < samples; sample += 1) {
    const distance = total * sample / (samples - 1);
    while (segment < distances.length - 1 && distances[segment] < distance) segment += 1;
    const startDistance = distances[segment - 1];
    const endDistance = distances[segment];
    const ratio = endDistance === startDistance ? 0 : (distance - startDistance) / (endDistance - startDistance);
    const point = [
      line[segment - 1][0] + (line[segment][0] - line[segment - 1][0]) * ratio,
      line[segment - 1][1] + (line[segment][1] - line[segment - 1][1]) * ratio
    ];
    const x = Math.max(0, Math.min(reading.width - 1, (point[0] - bounds[0]) / (bounds[2] - bounds[0]) * reading.width));
    const y = Math.max(0, Math.min(reading.height - 1, (bounds[3] - point[1]) / (bounds[3] - bounds[1]) * reading.height));
    const value = reading.values[Math.floor(y) * reading.width + Math.floor(x)];
    if (Number.isFinite(value)) profile.push({ distance, elevation: value, coord: point });
  }
  return profile;
}
function cumulativeDistances(line) {
  const values = [0];
  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1], b = line[i];
    const lat = (a[1] + b[1]) / 2 * Math.PI / 180;
    const dx = (b[0] - a[0]) * Math.cos(lat) * 111320;
    const dy = (b[1] - a[1]) * 110540;
    values.push(values[i - 1] + Math.hypot(dx, dy));
  }
  return values;
}
function format(value, precision) {
  const digits = precision === "unit" ? 0 : precision === "decimal1" ? 1 : 2;
  return value.toFixed(digits);
}
function formatSignedPercent(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
function linearTrend(points) {
  const count = points.length;
  const meanX = points.reduce((sum, point) => sum + point.distance, 0) / count;
  const meanY = points.reduce((sum, point) => sum + point.elevation, 0) / count;
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    numerator += (point.distance - meanX) * (point.elevation - meanY);
    denominator += (point.distance - meanX) ** 2;
  }
  const slope = denominator === 0 ? 0 : numerator / denominator;
  return { slope, intercept: meanY - slope * meanX };
}
const plugin = {
  id: "geolibre-raster-elevation-profile",
  name: "Raster Elevation Profile",
  version: "0.1.1",
  engines: ["maplibre"],
  activate(app) {
    var _a, _b;
    manager = new ProfileManager(app);
    disposePanel = ((_a = app.registerRightPanel) == null ? void 0 : _a.call(app, {
      id: PANEL_ID,
      title: "Raster Elevation Profile",
      dock: "replace-style",
      defaultWidth: 380,
      render(container) {
        var _a2, _b2, _c, _d, _e, _f, _g;
        manager == null ? void 0 : manager.setMap((_a2 = app.getMap) == null ? void 0 : _a2.call(app));
        container.innerHTML = `<div class="raster-profile-panel"><h3>Raster Elevation Profile</h3><div class="raster-profile-section"><label class="raster-profile-label">Raster layer</label><select class="raster-profile-select" data-raster-profile-layer></select><label class="raster-profile-label">Precision</label><select class="raster-profile-select" data-raster-profile-precision><option value="unit">0 decimals</option><option value="decimal1">1 decimal</option><option value="decimal2">2 decimals</option></select><div class="raster-profile-buttons"><button class="raster-profile-button primary" data-raster-profile-draw>Draw line</button><button class="raster-profile-button" data-raster-profile-finish>Apply profile</button><button class="raster-profile-button" data-raster-profile-clear>Clear</button></div><div class="raster-profile-status" data-raster-profile-status></div></div><div class="raster-profile-stats" data-raster-profile-stats></div><div class="raster-profile-hover" data-raster-profile-hover></div><div class="raster-profile-chart" data-raster-profile-chart></div></div>`;
        const layerSelect = container.querySelector("[data-raster-profile-layer]");
        for (const layer of ((_b2 = app.listLayers) == null ? void 0 : _b2.call(app).filter((item) => /cog|raster/i.test(item.type))) ?? []) {
          const option = document.createElement("option");
          option.value = layer.id;
          option.textContent = layer.name;
          layerSelect.appendChild(option);
        }
        const status = container.querySelector("[data-raster-profile-status]");
        const precision = container.querySelector("[data-raster-profile-precision]");
        const setStatus = (text) => {
          status.textContent = text;
        };
        (_c = container.querySelector("[data-raster-profile-draw]")) == null ? void 0 : _c.addEventListener("click", () => setStatus("Click points on the map, then click Apply profile."));
        const map = (_d = app.getMap) == null ? void 0 : _d.call(app);
        let drawing = false;
        const click = (event) => {
          if (drawing) manager == null ? void 0 : manager.addPoint([event.lngLat.lng, event.lngLat.lat]);
        };
        (_e = container.querySelector("[data-raster-profile-draw]")) == null ? void 0 : _e.addEventListener("click", () => {
          drawing = true;
          map == null ? void 0 : map.on("click", click);
        });
        (_f = container.querySelector("[data-raster-profile-finish]")) == null ? void 0 : _f.addEventListener("click", async () => {
          drawing = false;
          map == null ? void 0 : map.off("click", click);
          try {
            setStatus("Reading raster window...");
            await (manager == null ? void 0 : manager.generate(layerSelect.value, 1, precision.value));
            setStatus("Profile updated.");
          } catch (error) {
            setStatus(error instanceof Error ? error.message : String(error));
          }
        });
        (_g = container.querySelector("[data-raster-profile-clear]")) == null ? void 0 : _g.addEventListener("click", () => {
          drawing = false;
          map == null ? void 0 : map.off("click", click);
          manager == null ? void 0 : manager.clear();
          container.querySelector("[data-raster-profile-chart]").textContent = "";
          container.querySelector("[data-raster-profile-stats]").textContent = "";
        });
        return () => map == null ? void 0 : map.off("click", click);
      }
    })) ?? null;
    (_b = app.openRightPanel) == null ? void 0 : _b.call(app, PANEL_ID);
  },
  deactivate(app) {
    var _a;
    (_a = app.closeRightPanel) == null ? void 0 : _a.call(app, PANEL_ID);
    disposePanel == null ? void 0 : disposePanel();
    disposePanel = null;
    manager == null ? void 0 : manager.clear();
    manager = null;
  }
};
export {
  plugin as default,
  plugin
};
