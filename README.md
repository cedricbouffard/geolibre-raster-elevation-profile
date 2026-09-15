# GeoLibre Raster Elevation Profile

An independent GeoLibre plugin for creating elevation profiles from loaded Cloud-Optimized GeoTIFF (COG) rasters.

## Difference from the Built-in Elevation Profile

GeoLibre already includes an **Elevation Profile** plugin that uses terrain data from Open-Meteo on MapLibre. That service can provide rounded elevation values, which may hide small variations on relatively flat terrain.

This plugin uses the currently loaded raster directly through GeoLibre's `readRasterWindow()` API instead:

- It does not use Open-Meteo.
- It reads values from the active COG raster.
- It preserves the raster's decimal precision.
- It uses the raster's own NoData handling and overview selection.
- It creates the profile from the actual visible raster data.

## Features

- Select a loaded COG raster layer.
- Draw a line on the map by clicking points.
- Generate an elevation profile from the raster window.
- Display distance, minimum, maximum, elevation range, and trend slope.
- Show a linear trend line and its slope in percent.
- Synchronize a map marker with chart hover.
- Configure display precision with 0, 1, or 2 decimals.
- Export-ready bundled GeoLibre plugin archive.

## Installation

Install the packaged archive from GeoLibre's **Manage Plugins → Install from file** dialog:

```text
geolibre-plugin/geolibre-raster-elevation-profile-0.1.1.zip
```

Load a single-band COG raster in GeoLibre before opening the plugin.

## Development

```bash
npm install
npm run typecheck
npm run build
npm run package
```

The local manifest is served with:

```bash
npm run serve 8090
```

The manifest URL is `http://localhost:8090/plugin.json`.

## Requirements

The host GeoLibre build must expose `readRasterWindow()`, provided by the batched viewport-read API in `maplibre-gl-raster`. The plugin uses this API to read one raster window instead of issuing individual pixel requests.

## License

MIT
