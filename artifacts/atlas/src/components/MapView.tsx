import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// The production bundle has to ship MapLibre's worker itself; the dev server resolves it on its own.
if (import.meta.env.PROD) setWorkerUrl(maplibreWorkerUrl);
import type { WorkSpot, Category } from "@/lib/types";
import { CATEGORIES, calcScore, getSpotDisplayTags, SCORE_CATEGORIES, isOpenNow, getTodayHoursLabel } from "@/lib/types";
import { getGoogleMapsUrl, getAppleMapsUrl } from "@/lib/export";
import { iconSvg } from "@/lib/icons";
import { fetchAllCrowdStatuses, submitCrowdReport, getBusynessInfo, timeAgo, BUSYNESS_LEVELS, crowdMarkHtml, type CrowdStatus } from "@/lib/crowd";

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// A teardrop pin per category: the pin colour comes from map.pin.<category>, the icon from map.pin.icon.
// The square is turned 45 degrees, so its pointed corner lands s/2 + s/sqrt(2) below the box's top.
function createMarkerIcon(category: Category, selected = false): L.DivIcon {
  const cat = CATEGORIES.find((c) => c.value === category);
  const size = selected ? 36 : 28;
  const tip = Math.round(size / 2 + size / Math.SQRT2);
  return L.divIcon({
    className: "atlas-marker",
    html: `<div class="atlas-pin ${category}${selected ? " selected" : ""}">${iconSvg(cat?.icon ?? "map-pin", "fill", selected ? 18 : 14)}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, tip],
    popupAnchor: [0, -tip],
  });
}

function createCrowdHtml(status: CrowdStatus | null, spotId: string): string {
  if (status) {
    const info = getBusynessInfo(status.level);
    return `<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px;padding:4px 8px;background:var(--color-surface-raised);border-radius:6px;">
      ${crowdMarkHtml(info.level)}
      <span style="font-weight:500;font-size:var(--type-label-font-size);letter-spacing:var(--type-label-letter-spacing);color:var(--color-text-primary);">${escapeHtml(info.label)}</span>
      <span style="font-size:var(--type-label-font-size);letter-spacing:var(--type-label-letter-spacing);color:var(--color-text-secondary);">${timeAgo(status.lastReportedAt)}</span>
    </div>
    <button data-crowd-report="${escapeHtml(spotId)}" style="
      display:block;width:100%;padding:5px 0;border:1px solid var(--color-border-control);border-radius:6px;background:var(--color-surface-card);
      color:var(--color-text-primary);font-size:var(--type-label-font-size);letter-spacing:var(--type-label-letter-spacing);font-family:inherit;font-weight:500;cursor:pointer;margin-bottom:8px;
    "><span style="display:inline-flex;align-items:center;justify-content:center;gap:6px;">${iconSvg("users-three", "bold", 16)}Report crowd level</span></button>`;
  }
  return `<button data-crowd-report="${escapeHtml(spotId)}" style="
    display:block;width:100%;padding:5px 0;border:1px solid var(--color-border-control);border-radius:6px;background:var(--color-surface-card);
    color:var(--color-text-primary);font-size:var(--type-label-font-size);letter-spacing:var(--type-label-letter-spacing);font-family:inherit;font-weight:500;cursor:pointer;margin-bottom:8px;
  "><span style="display:inline-flex;align-items:center;justify-content:center;gap:6px;">${iconSvg("users-three", "bold", 16)}Report crowd level</span></button>`;
}

function createCrowdPickerHtml(spotId: string): string {
  // Words only: the picker is a control, so it must not read as a colour legend
  const options = BUSYNESS_LEVELS.map((b) =>
    `<button data-crowd-submit="${escapeHtml(spotId)}" data-crowd-level="${b.level}" style="
      display:block;width:100%;padding:5px 8px;border:1px solid var(--color-border-control);
      border-radius:6px;background:var(--color-surface-card);color:var(--color-text-primary);
      font-size:var(--type-label-font-size);letter-spacing:var(--type-label-letter-spacing);font-family:inherit;cursor:pointer;text-align:left;
    ">${escapeHtml(b.label)}</button>`
  ).join("");
  return `<div style="display:flex;flex-direction:column;gap:3px;margin-bottom:8px;">${options}</div>`;
}

function createPopupContent(spot: WorkSpot, crowdStatus: CrowdStatus | null): string {
  const cat = CATEGORIES.find((c) => c.value === spot.category);
  const safeName = escapeHtml(spot.name);
  const safeAddress = escapeHtml(spot.address);
  const safeCategory = escapeHtml(cat?.label || spot.category);
  const score = calcScore(spot.scores, spot.tags);
  const tags = getSpotDisplayTags(spot);

  const googleUrl = getGoogleMapsUrl(spot.lat, spot.lng, spot.name);
  const appleUrl = getAppleMapsUrl(spot.lat, spot.lng, spot.name);

  const tagPills = tags.slice(0, 6).map((t) =>
    `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:var(--type-label-font-size);letter-spacing:var(--type-label-letter-spacing);color:var(--color-text-primary);border:1px solid var(--color-border-divider);">${escapeHtml(t)}</span>`
  ).join(" ");

  const summaryHtml = spot.aiSummary
    ? `<p style="font-size:var(--type-body-s-font-size);letter-spacing:var(--type-body-s-letter-spacing);line-height:var(--type-body-s-line-height);color:var(--color-text-secondary);margin:0 0 8px;font-style:italic;">${escapeHtml(spot.aiSummary)}</p>`
    : spot.description
      ? `<p style="font-size:var(--type-body-s-font-size);letter-spacing:var(--type-body-s-letter-spacing);line-height:var(--type-body-s-line-height);color:var(--color-text-secondary);margin:0 0 8px;">${escapeHtml(spot.description)}</p>`
      : "";

  const crowdHtml = createCrowdHtml(crowdStatus, spot.id);

  return `<div style="max-width:280px;padding:4px;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
      <span style="display:flex;color:var(--color-text-primary);">${iconSvg(cat?.icon ?? "map-pin", cat ? "regular" : "fill", 20)}</span>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:var(--type-body-m-font-size);letter-spacing:var(--type-body-m-letter-spacing);line-height:var(--type-body-m-line-height);color:var(--color-text-primary);">${safeName}</div>
        <div style="font-size:var(--type-label-font-size);letter-spacing:var(--text-tracking-plus-6);color:var(--color-text-secondary);text-transform:uppercase;">${safeCategory} &middot; ${escapeHtml(spot.city)}</div>
      </div>
      <div style="text-align:center;">
        <div style="background:var(--color-action-primary-bg);color:var(--color-action-primary-text);font-weight:700;font-size:var(--type-body-s-font-size);letter-spacing:var(--type-body-s-letter-spacing);padding:3px 8px;border-radius:6px;">${score.toFixed(1)}</div>
        ${spot.ratingCount !== undefined ? `<div style="font-size:var(--type-label-font-size);letter-spacing:var(--type-label-letter-spacing);color:var(--color-text-secondary);margin-top:2px;white-space:nowrap;">${spot.ratingCount === 1 ? "1 rating" : `${spot.ratingCount} ratings`}</div>` : ""}
      </div>
    </div>
    <div style="font-size:var(--type-body-s-font-size);letter-spacing:var(--type-body-s-letter-spacing);line-height:var(--type-body-s-line-height);color:var(--color-text-secondary);margin-bottom:6px;">${safeAddress}</div>
    ${spot.website && /^https?:\/\//i.test(spot.website) ? `<div style="font-size:var(--type-body-s-font-size);letter-spacing:var(--type-body-s-letter-spacing);margin-bottom:6px;"><a href="${escapeHtml(spot.website)}" target="_blank" rel="noopener" style="color:var(--color-text-primary);text-decoration:underline;">Website &#8599;</a></div>` : ""}
    ${spot.operatingHours ? `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      ${(() => {
        const open = isOpenNow(spot.operatingHours);
        const dot = open
          ? `<span style="width:var(--dot-size);height:var(--dot-size);border-radius:50%;background:var(--color-dot-open);flex-shrink:0;"></span>`
          : `<span style="width:var(--dot-size);height:var(--dot-size);border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--color-dot-closed);flex-shrink:0;"></span>`;
        return `${dot}<span style="font-size:var(--type-label-font-size);letter-spacing:var(--type-label-letter-spacing);font-weight:500;color:${open ? "var(--color-text-primary)" : "var(--color-text-tertiary)"};">${open ? "Open" : "Closed"}</span>
      <span style="font-size:var(--type-label-font-size);letter-spacing:var(--type-label-letter-spacing);color:${open ? "var(--color-text-secondary)" : "var(--color-text-tertiary)"};">${escapeHtml(getTodayHoursLabel(spot.operatingHours!))}</span>`;
      })()}
    </div>` : ''}
    ${summaryHtml}
    ${crowdHtml}
    <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px;">
      ${tagPills}
    </div>
    <div style="display:flex;gap:6px;">
      <a href="${googleUrl}" target="_blank" rel="noopener" style="
        flex:1;text-align:center;padding:6px 0;border-radius:6px;font-size:var(--type-label-font-size);letter-spacing:var(--type-label-letter-spacing);font-weight:500;
        border:1px solid var(--color-border-control);background:var(--color-surface-card);color:var(--color-text-primary);text-decoration:none;
      ">Google Maps</a>
      <a href="${appleUrl}" target="_blank" rel="noopener" style="
        flex:1;text-align:center;padding:6px 0;border-radius:6px;font-size:var(--type-label-font-size);letter-spacing:var(--type-label-letter-spacing);font-weight:500;
        border:1px solid var(--color-border-control);background:var(--color-surface-card);color:var(--color-text-primary);text-decoration:none;
      ">Apple Maps</a>
    </div>
  </div>`;
}

interface MapViewProps {
  spots: WorkSpot[];
  selectedSpotId: string | null;
  onMapClick: (lat: number, lng: number) => void;
  onSpotSelect: (id: string | null) => void;
  pendingLocation: { lat: number; lng: number } | null;
}

export default function MapView({ spots, selectedSpotId, onMapClick, onSpotSelect, pendingLocation }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const selectedIdRef = useRef<string | null>(null);
  const pendingMarkerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [crowdStatuses, setCrowdStatuses] = useState<Record<string, CrowdStatus>>({});
  const crowdStatusesRef = useRef(crowdStatuses);
  crowdStatusesRef.current = crowdStatuses;

  const loadCrowdStatuses = useCallback(() => {
    fetchAllCrowdStatuses().then(setCrowdStatuses);
  }, []);

  useEffect(() => {
    loadCrowdStatuses();
  }, [loadCrowdStatuses]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      zoomAnimation: !reduceMotion,
      fadeAnimation: !reduceMotion,
      markerZoomAnimation: !reduceMotion,
    }).setView([30.27, -97.74], 12);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // OpenFreeMap: free, keyless vector tiles built on OpenStreetMap data.
    // The style carries its own OpenFreeMap and OpenStreetMap credits
    maplibreGL({ style: "https://tiles.openfreemap.org/styles/positron" }).addTo(map);

    mapRef.current = map;

    const handlePopupClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const reportBtn = target.closest("[data-crowd-report]") as HTMLElement;
      const submitBtn = target.closest("[data-crowd-submit]") as HTMLElement;

      if (reportBtn) {
        e.stopPropagation();
        const spotId = reportBtn.dataset.crowdReport!;
        const parent = reportBtn.parentElement;
        if (parent) {
          reportBtn.style.display = "none";
          const pickerDiv = document.createElement("div");
          pickerDiv.innerHTML = createCrowdPickerHtml(spotId);
          reportBtn.insertAdjacentElement("afterend", pickerDiv);
        }
      }

      if (submitBtn) {
        e.stopPropagation();
        const spotId = submitBtn.dataset.crowdSubmit!;
        const level = parseInt(submitBtn.dataset.crowdLevel!, 10);
        submitBtn.textContent = "Submitting...";
        const ok = await submitCrowdReport(spotId, level);
        if (ok) {
          const parent = submitBtn.closest(".leaflet-popup-content");
          if (parent) {
            const picker = submitBtn.parentElement?.parentElement;
            if (picker) {
              picker.innerHTML = `<div style="font-size:var(--type-label-font-size);letter-spacing:var(--type-label-letter-spacing);color:var(--color-status-positive-text);font-weight:500;padding:4px 0;margin-bottom:6px;">&#10003; Report submitted</div>`;
            }
          }
          loadCrowdStatuses();
        }
      }
    };

    map.getContainer().addEventListener("click", handlePopupClick);

    return () => {
      map.getContainer().removeEventListener("click", handlePopupClick);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

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
      const crowdStatus = crowdStatuses[spot.id] || null;
      if (!marker) {
        marker = L.marker([spot.lat, spot.lng], {
          icon: createMarkerIcon(spot.category, spot.id === selectedIdRef.current),
        }).addTo(map);

        marker.bindPopup(createPopupContent(spot, crowdStatus), {
          maxWidth: 300,
          className: "atlas-popup",
        });

        marker.on("click", () => {
          onSpotSelect(spot.id);
        });

        markersRef.current.set(spot.id, marker);
      } else {
        marker.setLatLng([spot.lat, spot.lng]);
        marker.setIcon(createMarkerIcon(spot.category, spot.id === selectedIdRef.current));
        marker.setPopupContent(createPopupContent(spot, crowdStatus));
      }
    });
  }, [spots, onSpotSelect, crowdStatuses]);

  useEffect(() => {
    // Redraw the previously selected pin at rest and the new one selected
    const previous = selectedIdRef.current;
    selectedIdRef.current = selectedSpotId ?? null;
    for (const id of [previous, selectedSpotId]) {
      if (!id) continue;
      const spot = spots.find((s) => s.id === id);
      const m = markersRef.current.get(id);
      if (spot && m) m.setIcon(createMarkerIcon(spot.category, id === selectedSpotId));
    }
    if (!selectedSpotId || !mapRef.current) return;
    const marker = markersRef.current.get(selectedSpotId);
    if (marker) {
      const spot = spots.find((s) => s.id === selectedSpotId);
      if (spot) {
        mapRef.current.setView([spot.lat, spot.lng], 15, { animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
        marker.openPopup();
      }
    }
  }, [selectedSpotId, spots]);

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
          html: `<div class="atlas-pin pending">${iconSvg("plus", "bold", 14)}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 34],
        }),
      }).addTo(map);
      pendingMarkerRef.current = marker;
      map.setView([pendingLocation.lat, pendingLocation.lng], map.getZoom(), { animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    }
  }, [pendingLocation]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !mapRef.current) return;
    const observer = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The basemap is light in both themes until its dark recolour, so the map, its markers and popups stay in Atlas Light
  return <div ref={containerRef} className="atlas-map" data-theme="light" style={{ width: "100%", height: "100%" }} />;
}
