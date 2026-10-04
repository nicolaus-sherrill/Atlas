import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// The production bundle has to ship MapLibre's worker itself; the dev server resolves it on its own.
if (import.meta.env.PROD) setWorkerUrl(maplibreWorkerUrl);
import type { WorkSpot, Category } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { iconSvg } from "@/lib/icons";
import { moveCamera, nudgeIntoView, comfortablyInView, type ClearArea } from "@/lib/camera";
import { useMediaQuery } from "@/hooks/use-media-query";

// OpenFreeMap's own styles, served as they are with no recolour: Positron for light, Dark for dark
const BASEMAP = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

// A teardrop pin per category: the pin colour comes from map.pin.<category>, the icon from map.pin.icon.
// The square is turned 45 degrees, so its pointed corner lands s/2 + s/sqrt(2) below the box's top.
// Today's pins stay in Atlas Light on either basemap: their green-50 halo is what keeps the dark
// coworking pin visible on the dark map (Decision 6). Step 8 replaces them with inverting markers.
function createMarkerIcon(category: Category, selected = false): L.DivIcon {
  const cat = CATEGORIES.find((c) => c.value === category);
  const size = selected ? 36 : 28;
  const tip = Math.round(size / 2 + size / Math.SQRT2);
  return L.divIcon({
    className: "atlas-marker",
    html: `<div class="atlas-pin ${category}${selected ? " selected" : ""}" data-theme="light">${iconSvg(cat?.icon ?? "map-pin", "fill", selected ? 18 : 14)}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, tip],
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
  onMapClick: (lat: number, lng: number) => void;
  onMarkerSelect: (id: string) => void;
  pendingLocation: { lat: number; lng: number } | null;
  // A place picked from the search; the camera moves there when seq changes
  cameraTarget: { lat: number; lng: number; seq: number } | null;
  // Hands the map to the app's own controls once it exists
  onReady?: (map: L.Map) => void;
}

export default function MapView({ spots, selection, centreEveryPick, getClearArea, onMapClick, onMarkerSelect, pendingLocation, cameraTarget, onReady }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const selectedIdRef = useRef<string | null>(null);
  const pendingMarkerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // The basemap follows the page's theme: a forced data-theme on the root wins, then the system's
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const forced = document.documentElement.dataset.theme;
  const theme: "light" | "dark" = forced === "dark" || forced === "light" ? forced : prefersDark ? "dark" : "light";
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

  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onMarkerSelectRef = useRef(onMarkerSelect);
  onMarkerSelectRef.current = onMarkerSelect;
  const getClearAreaRef = useRef(getClearArea);
  getClearAreaRef.current = getClearArea;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handler = (e: L.LeafletMouseEvent) => {
      onMapClickRef.current(e.latlng.lat, e.latlng.lng);
    };
    map.on("click", handler);

    return () => {
      map.off("click", handler);
    };
  }, []);

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
          icon: createMarkerIcon(spot.category, spot.id === selectedIdRef.current),
        }).addTo(map);

        marker.on("click", () => onMarkerSelectRef.current(spot.id));

        markersRef.current.set(spot.id, marker);
      } else {
        marker.setLatLng([spot.lat, spot.lng]);
        marker.setIcon(createMarkerIcon(spot.category, spot.id === selectedIdRef.current));
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
      if (spot && m) m.setIcon(createMarkerIcon(spot.category, id === selectedId));
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
        nudgeIntoView(map, target, area);
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pendingMarkerRef.current) {
      pendingMarkerRef.current.remove();
      pendingMarkerRef.current = null;
    }

    if (pendingLocation) {
      const marker = L.marker([pendingLocation.lat, pendingLocation.lng], {
        // A hollow pin with a plus: the spot being added, not yet on the map
        icon: L.divIcon({
          className: "atlas-marker-pending",
          html: `<div class="atlas-pin pending" data-theme="light">${iconSvg("plus", "bold", 14)}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 34],
        }),
      }).addTo(map);
      pendingMarkerRef.current = marker;
      // A tap on the map is already in view; a name or address picked in the form may not be
      const target = L.latLng(pendingLocation.lat, pendingLocation.lng);
      const area = getClearAreaRef.current(map);
      if (!comfortablyInView(map, target, area)) moveCamera(map, target, Math.max(map.getZoom(), 15), area);
    }
  }, [pendingLocation]);

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
