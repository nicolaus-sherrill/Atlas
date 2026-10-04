import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// The production bundle has to ship MapLibre's worker itself; the dev server resolves it on its own.
if (import.meta.env.PROD) setWorkerUrl(maplibreWorkerUrl);
import type { WorkSpot } from "@/lib/types";
import { CATEGORIES, calcScore } from "@/lib/types";
import { iconSvg } from "@/lib/icons";
import { moveCamera, nudgeIntoView, comfortablyInView, type ClearArea } from "@/lib/camera";

// OpenFreeMap's own styles, served as they are with no recolour: Positron for light, Dark for dark
const BASEMAP = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// The tip, hung from the pill's bottom edge and never inside it: an outer triangle in the stroke
// colour that continues the pill's stroke, and an inner one in the fill, inset by the stroke's
// width, that opens it. The stroke meets the pill's outline at two corners. Its point is the spot.
const TIP = `<svg class="pin-tip" viewBox="0 0 14 8" aria-hidden="true"><polygon class="pin-tip-o" points="0,0 14,0 7,7"/><polygon class="pin-tip-i" points="2.83,0 11.17,0 7,4.17"/></svg>`;

// The score pill (Decision 5, direction 4). At rest: the category's colour, its icon and the score.
// Selected: the card's surface with the category as the stroke, the icon in the neutral ink, then
// the name, then the score in the list's chip. Hover shows the name above. Colours come from the
// --pin-* Patterns tokens, which follow the theme.
function createMarkerIcon(spot: WorkSpot, selected = false): L.DivIcon {
  const cat = CATEGORIES.find((c) => c.value === spot.category);
  const score = calcScore(spot.scores, spot.tags).toFixed(1);
  const icon = iconSvg(cat?.icon ?? "map-pin", "fill", selected ? 16 : 12);
  const name = escapeHtml(spot.name);
  const body = selected
    ? `${icon}<span class="pin-name">${name}</span><span class="pin-chip">${score}</span>`
    : `${icon}<span>${score}</span>`;
  return L.divIcon({
    className: "atlas-marker",
    // No size: the pin sizes itself, and CSS lifts it so the tip's point sits on the spot
    iconSize: undefined,
    html: `<div class="pin pin-${spot.category}${selected ? " is-selected" : ""}"><span class="pin-label">${name}</span><span class="pin-pill">${body}${TIP}</span></div>`,
  });
}

interface MapViewProps {
  spots: WorkSpot[];
  // The selected spot, and where it was picked: a list pick may move the camera, a marker click
  // only nudges a hidden pin into view. seq makes picking the same spot again count
  selection: { id: string; source: "list" | "marker"; seq: number } | null;
  // Under A (one card) every list pick centres the spot; under B only one not comfortably in view
  centreEveryPick: boolean;
  // The part of the map the cards leave clear, at rest
  getClearArea: (map: L.Map) => ClearArea;
  onMarkerSelect: (id: string) => void;
  // A place picked from the search; the camera moves there when seq changes
  cameraTarget: { lat: number; lng: number; seq: number } | null;
  // Hands the map to the app's own controls once it exists
  onReady?: (map: L.Map) => void;
  // The page's resolved theme, which picks the basemap
  theme: "light" | "dark";
}

export default function MapView({ spots, selection, centreEveryPick, getClearArea, onMarkerSelect, cameraTarget, onReady, theme }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const selectedIdRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const basemapRef = useRef<ReturnType<typeof maplibreGL> | null>(null);
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      zoomAnimation: !reduceMotion,
      fadeAnimation: !reduceMotion,
      markerZoomAnimation: !reduceMotion,
    }).setView([30.27, -97.74], 12);

    // OpenFreeMap: free, keyless vector tiles built on OpenStreetMap data.
    // The style carries its own OpenFreeMap and OpenStreetMap credits
    basemapRef.current = maplibreGL({ style: BASEMAP[themeRef.current] }).addTo(map);

    mapRef.current = map;
    onReady?.(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const onMarkerSelectRef = useRef(onMarkerSelect);
  onMarkerSelectRef.current = onMarkerSelect;
  const getClearAreaRef = useRef(getClearArea);
  getClearAreaRef.current = getClearArea;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const existingIds = new Set(spots.map((s) => s.id));
    markersRef.current.forEach((marker, id) => {
      if (!existingIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    spots.forEach((spot) => {
      let marker = markersRef.current.get(spot.id);
      if (!marker) {
        marker = L.marker([spot.lat, spot.lng], {
          icon: createMarkerIcon(spot, spot.id === selectedIdRef.current),
          // the name for assistive tech and the browser's own tooltip, and keyboard focus
          title: spot.name,
          alt: spot.name,
          keyboard: true,
          riseOnHover: true,
          zIndexOffset: spot.id === selectedIdRef.current ? 1000 : 0,
        }).addTo(map);

        marker.on("click", () => onMarkerSelectRef.current(spot.id));

        markersRef.current.set(spot.id, marker);
      } else {
        marker.setLatLng([spot.lat, spot.lng]);
        marker.setIcon(createMarkerIcon(spot, spot.id === selectedIdRef.current));
      }
    });
  }, [spots]);

  const selectedId = selection?.id ?? null;

  useEffect(() => {
    // Redraw the previously selected pin at rest and the new one selected
    const previous = selectedIdRef.current;
    selectedIdRef.current = selectedId;
    for (const id of [previous, selectedId]) {
      if (!id) continue;
      const spot = spots.find((s) => s.id === id);
      const m = markersRef.current.get(id);
      if (spot && m) {
        m.setIcon(createMarkerIcon(spot, id === selectedId));
        // the selected pill sits over its neighbours
        m.setZIndexOffset(id === selectedId ? 1000 : 0);
      }
    }
  }, [selectedId, spots]);

  // The camera rule. Hover never moves the map. A marker click nudges the map only if the pin is
  // hidden under a card or near an edge. A list pick moves it only if the spot isn't comfortably in
  // the clear area, or the map is zoomed out below 13; the move keeps the user's zoom, or goes to 15
  // from below 13. Under A, every list pick centres the spot.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selection) return;
    const spot = spots.find((s) => s.id === selection.id);
    if (!spot) return;
    const target = L.latLng(spot.lat, spot.lng);
    // A frame later, so a sheet opening in the same render has its class and the area is measured with it
    const frame = requestAnimationFrame(() => {
      const area = getClearAreaRef.current(map);
      if (selection.source === "marker") {
        // The selected pill is wider and taller than the margin, and hangs above and to both sides
        // of its point, so clear its measured box with 16px to spare
        const pin = markersRef.current.get(spot.id)?.getElement()?.querySelector<HTMLElement>(".pin");
        const side = pin ? Math.max(48, pin.offsetWidth / 2 + 16) : 48;
        const top = pin ? Math.max(48, pin.offsetHeight + 16) : 48;
        nudgeIntoView(map, target, area, 48, side, top);
        return;
      }
      const zoomedOut = map.getZoom() < 13;
      if (centreEveryPick || zoomedOut || !comfortablyInView(map, target, area)) {
        moveCamera(map, target, zoomedOut ? 15 : map.getZoom(), area);
      }
    });
    return () => cancelAnimationFrame(frame);
    // Only a new pick moves the camera, never a change to the spots list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.seq]);

  // Move to a picked place, centred in the map the list card leaves clear. If the card is still
  // narrowing from the table, wait for it to settle so the clear area is measured at rest.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cameraTarget) return;
    let cancelled = false;
    const card = document.querySelector(".list-card");
    const settling = card ? card.getAnimations().map((a) => a.finished) : [];
    Promise.race([Promise.allSettled(settling), new Promise((r) => setTimeout(r, 700))]).then(() => {
      if (cancelled) return;
      const zoom = map.getZoom() < 13 ? 15 : map.getZoom();
      moveCamera(map, [cameraTarget.lat, cameraTarget.lng], zoom, getClearAreaRef.current(map));
    });
    return () => {
      cancelled = true;
    };
  }, [cameraTarget]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !mapRef.current) return;
    const observer = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Swap the basemap's style when the theme changes; the map itself, its camera and markers stay put
  const appliedThemeRef = useRef(theme);
  useEffect(() => {
    if (theme === appliedThemeRef.current) return;
    appliedThemeRef.current = theme;
    basemapRef.current?.getMaplibreMap()?.setStyle(BASEMAP[theme]);
  }, [theme]);

  return <div ref={containerRef} className="atlas-map" style={{ width: "100%", height: "100%" }} />;
}
