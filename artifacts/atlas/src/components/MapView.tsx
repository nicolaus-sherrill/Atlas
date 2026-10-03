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
import { CATEGORIES, calcScore, getSpotDisplayTags, scoreToLabel, SCORE_CATEGORIES, isOpenNow, getTodayHoursLabel } from "@/lib/types";
import { getGoogleMapsUrl, getAppleMapsUrl } from "@/lib/export";
import { fetchAllCrowdStatuses, submitCrowdReport, getBusynessInfo, timeAgo, BUSYNESS_LEVELS, type CrowdStatus } from "@/lib/crowd";

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

const CATEGORY_COLORS: Record<Category, string> = {
  cafe: "#C8B89A",
  library: "#8A9E8C",
  coworking: "#1A1A18",
  park: "#6B8F71",
};

function createMarkerIcon(category: Category): L.DivIcon {
  const cat = CATEGORIES.find((c) => c.value === category);
  const color = CATEGORY_COLORS[category];
  return L.divIcon({
    className: "atlas-marker",
    html: `<div style="
      background: ${color};
      width: 36px;
      height: 36px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #F5F3EF;
      box-shadow: 0 2px 8px rgba(26,26,24,0.2);
    ">
      <span style="transform: rotate(45deg); font-size: 16px; line-height: 1;">${cat?.icon || "📍"}</span>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

function createCrowdHtml(status: CrowdStatus | null, spotId: string): string {
  if (status) {
    const info = getBusynessInfo(status.level);
    return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;padding:4px 8px;background:#F5F3EF;border-radius:6px;">
      <span style="width:8px;height:8px;border-radius:50%;background:${info.color};display:inline-block;"></span>
      <span style="font-weight:500;font-size:12px;color:var(--color-text-primary);">${escapeHtml(info.label)}</span>
      <span style="font-size:10px;color:var(--color-text-secondary);">${timeAgo(status.lastReportedAt)}</span>
    </div>
    <button data-crowd-report="${escapeHtml(spotId)}" style="
      display:block;width:100%;padding:5px 0;border:1px solid var(--color-border-control);border-radius:6px;background:var(--color-surface-card);
      color:var(--color-text-primary);font-size:11px;font-family:inherit;font-weight:500;cursor:pointer;margin-bottom:8px;
    ">&#128101; Report crowd level</button>`;
  }
  return `<button data-crowd-report="${escapeHtml(spotId)}" style="
    display:block;width:100%;padding:5px 0;border:1px solid var(--color-border-control);border-radius:6px;background:var(--color-surface-card);
    color:var(--color-text-primary);font-size:11px;font-family:inherit;font-weight:500;cursor:pointer;margin-bottom:8px;
  ">&#128101; Report crowd level</button>`;
}

function createCrowdPickerHtml(spotId: string): string {
  const options = BUSYNESS_LEVELS.map((b) =>
    `<button data-crowd-submit="${escapeHtml(spotId)}" data-crowd-level="${b.level}" style="
      display:flex;align-items:center;gap:6px;width:100%;padding:5px 8px;border:1px solid #E5E1DA;
      border-left:3px solid ${b.color};border-radius:6px;background:#fff;color:#1A1A18;
      font-size:11px;font-family:inherit;cursor:pointer;text-align:left;
    "><span style="width:6px;height:6px;border-radius:50%;background:${b.color};"></span>${escapeHtml(b.label)}</button>`
  ).join("");
  return `<div style="display:flex;flex-direction:column;gap:3px;margin-bottom:8px;">${options}</div>`;
}

function createPopupContent(spot: WorkSpot, crowdStatus: CrowdStatus | null): string {
  const cat = CATEGORIES.find((c) => c.value === spot.category);
  const safeName = escapeHtml(spot.name);
  const safeAddress = escapeHtml(spot.address);
  const safeCategory = escapeHtml(cat?.label || spot.category);
  const score = calcScore(spot.scores, spot.tags);
  const label = scoreToLabel(score);
  const tags = getSpotDisplayTags(spot);

  const googleUrl = getGoogleMapsUrl(spot.lat, spot.lng, spot.name);
  const appleUrl = getAppleMapsUrl(spot.lat, spot.lng, spot.name);

  const tagPills = tags.slice(0, 6).map((t) =>
    `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;color:var(--color-text-primary);border:1px solid var(--color-border-divider);">${escapeHtml(t)}</span>`
  ).join(" ");

  const summaryHtml = spot.aiSummary
    ? `<p style="font-size:12px;color:var(--color-text-secondary);margin:0 0 8px;line-height:1.5;font-style:italic;">${escapeHtml(spot.aiSummary)}</p>`
    : spot.description
      ? `<p style="font-size:12px;color:var(--color-text-secondary);margin:0 0 8px;line-height:1.5;">${escapeHtml(spot.description)}</p>`
      : "";

  const crowdHtml = createCrowdHtml(crowdStatus, spot.id);

  return `<div style="max-width:280px;padding:4px;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
      <span style="font-size:18px;">${cat?.icon || "📍"}</span>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:15px;color:var(--color-text-primary);line-height:1.2;">${safeName}</div>
        <div style="font-size:11px;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.5px;">${safeCategory} &middot; ${escapeHtml(spot.city)}</div>
      </div>
      <div style="text-align:center;">
        <div style="background:var(--color-action-primary-bg);color:var(--color-action-primary-text);font-weight:700;font-size:13px;padding:3px 8px;border-radius:6px;">${score.toFixed(1)}</div>
        <div style="font-size:11px;letter-spacing:1px;margin-top:2px;"><span style="color:#8A9E8C;">${"●".repeat(Math.round(score))}</span><span style="color:#D5D0C8;">${"○".repeat(5 - Math.round(score))}</span></div>
        <div style="font-size:9px;color:#1A1A18;opacity:0.5;margin-top:1px;">${label}</div>
      </div>
    </div>
    <div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:6px;">${safeAddress}</div>
    ${spot.website && /^https?:\/\//i.test(spot.website) ? `<div style="font-size:12px;margin-bottom:6px;"><a href="${escapeHtml(spot.website)}" target="_blank" rel="noopener" style="color:var(--color-text-primary);text-decoration:underline;">Website &#8599;</a></div>` : ""}
    ${spot.operatingHours ? `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;color:#fff;background:${isOpenNow(spot.operatingHours) ? '#4a7c59' : '#8b4513'};">${isOpenNow(spot.operatingHours) ? 'Open' : 'Closed'}</span>
      <span style="font-size:11px;color:var(--color-text-secondary);">${escapeHtml(getTodayHoursLabel(spot.operatingHours))}</span>
    </div>` : ''}
    ${summaryHtml}
    ${crowdHtml}
    <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px;">
      ${tagPills}
    </div>
    <div style="display:flex;gap:6px;">
      <a href="${googleUrl}" target="_blank" rel="noopener" style="
        flex:1;text-align:center;padding:6px 0;border-radius:6px;font-size:11px;font-weight:500;
        border:1px solid var(--color-border-control);background:var(--color-surface-card);color:var(--color-text-primary);text-decoration:none;
      ">Google Maps</a>
      <a href="${appleUrl}" target="_blank" rel="noopener" style="
        flex:1;text-align:center;padding:6px 0;border-radius:6px;font-size:11px;font-weight:500;
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
              picker.innerHTML = `<div style="font-size:12px;color:#8A9E8C;font-weight:500;padding:4px 0;margin-bottom:6px;">&#10003; Report submitted</div>`;
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
          icon: createMarkerIcon(spot.category),
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
        marker.setIcon(createMarkerIcon(spot.category));
        marker.setPopupContent(createPopupContent(spot, crowdStatus));
      }
    });
  }, [spots, onSpotSelect, crowdStatuses]);

  useEffect(() => {
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
        icon: L.divIcon({
          className: "atlas-marker-pending",
          html: `<div style="
            background: #C8B89A;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid #F5F3EF;
            box-shadow: 0 0 0 3px #C8B89A, 0 4px 12px rgba(26,26,24,0.3);
            animation: pulse 1.5s ease-in-out infinite;
          ">
            <span style="font-size: 20px;">📍</span>
          </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
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
  return <div ref={containerRef} data-theme="light" style={{ width: "100%", height: "100%" }} />;
}
