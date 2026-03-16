import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { WorkSpot, Category } from "@/lib/types";
import { CATEGORIES, calcScore, getSpotDisplayTags, scoreToLabel, SCORE_CATEGORIES } from "@/lib/types";
import { getGoogleMapsUrl, getAppleMapsUrl } from "@/lib/export";

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

function createPopupContent(spot: WorkSpot): string {
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
    `<span style="display:inline-block;padding:2px 8px;border-radius:10px;background:#F5F3EF;font-size:10px;color:#1A1A18;border:1px solid #E5E1DA;">${escapeHtml(t)}</span>`
  ).join(" ");

  const summaryHtml = spot.aiSummary
    ? `<p style="font-size:12px;color:#1A1A18;opacity:0.8;margin:0 0 8px;line-height:1.5;font-style:italic;">${escapeHtml(spot.aiSummary)}</p>`
    : spot.description
      ? `<p style="font-size:12px;color:#1A1A18;opacity:0.7;margin:0 0 8px;line-height:1.5;">${escapeHtml(spot.description)}</p>`
      : "";

  return `<div style="font-family:'Inter',sans-serif;max-width:280px;padding:4px;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
      <span style="font-size:18px;">${cat?.icon || "📍"}</span>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:15px;color:#1A1A18;line-height:1.2;">${safeName}</div>
        <div style="font-size:11px;color:#1A1A18;opacity:0.5;text-transform:uppercase;letter-spacing:0.5px;">${safeCategory} &middot; ${escapeHtml(spot.city)}</div>
      </div>
      <div style="text-align:center;">
        <div style="background:#8A9E8C;color:#fff;font-weight:700;font-size:13px;padding:3px 8px;border-radius:6px;">${score.toFixed(1)}</div>
        <div style="font-size:9px;color:#1A1A18;opacity:0.5;margin-top:2px;">${label}</div>
      </div>
    </div>
    <div style="font-size:12px;color:#1A1A18;opacity:0.6;margin-bottom:6px;">${safeAddress}</div>
    ${summaryHtml}
    <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px;">
      ${tagPills}
    </div>
    <div style="display:flex;gap:6px;">
      <a href="${googleUrl}" target="_blank" rel="noopener" style="
        flex:1;text-align:center;padding:6px 0;border-radius:6px;font-size:11px;font-weight:500;
        background:#1A1A18;color:#F5F3EF;text-decoration:none;
      ">Google Maps</a>
      <a href="${appleUrl}" target="_blank" rel="noopener" style="
        flex:1;text-align:center;padding:6px 0;border-radius:6px;font-size:11px;font-weight:500;
        background:#8A9E8C;color:#F5F3EF;text-decoration:none;
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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
    }).setView([30.27, -97.74], 12);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
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
      if (!marker) {
        marker = L.marker([spot.lat, spot.lng], {
          icon: createMarkerIcon(spot.category),
        }).addTo(map);

        marker.bindPopup(createPopupContent(spot), {
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
        marker.setPopupContent(createPopupContent(spot));
      }
    });
  }, [spots, onSpotSelect]);

  useEffect(() => {
    if (!selectedSpotId || !mapRef.current) return;
    const marker = markersRef.current.get(selectedSpotId);
    if (marker) {
      const spot = spots.find((s) => s.id === selectedSpotId);
      if (spot) {
        mapRef.current.setView([spot.lat, spot.lng], 15, { animate: true });
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
      map.setView([pendingLocation.lat, pendingLocation.lng], map.getZoom(), { animate: true });
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

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
