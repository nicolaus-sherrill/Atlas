import { useState } from "react";
import L from "leaflet";
import { moveCamera, clearArea } from "@/lib/camera";
import Icon from "./Icon";

interface MapControlsProps {
  map: L.Map | null;
  // Zoom and locate only mean something over the map; the chat button stays in both states
  mapOpen: boolean;
  onChatOpen: () => void;
  onNotice: (message: string) => void;
}

// The map's own buttons, drawn by the app rather than Leaflet: the zoom group (two 44px buttons
// split by a hairline), locate under it, and the chat button, which is the agent's avatar.
export default function MapControls({ map, mapOpen, onChatOpen, onNotice }: MapControlsProps) {
  const [locating, setLocating] = useState(false);
  const [youAreHere, setYouAreHere] = useState<L.CircleMarker | null>(null);

  const locate = () => {
    if (!map || locating) return;
    if (!navigator.geolocation) {
      onNotice("This browser can't share your location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const here = L.latLng(pos.coords.latitude, pos.coords.longitude);
        youAreHere?.remove();
        setYouAreHere(L.circleMarker(here, { radius: 7, weight: 3, className: "you-are-here" }).addTo(map));
        moveCamera(map, here, Math.max(map.getZoom(), 14), clearArea(map, [document.querySelector(".list-card")]));
      },
      () => {
        setLocating(false);
        onNotice("Couldn't find your location. Check that Atlas may use it.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <div className="map-controls">
      <div className="map-controls-map" inert={!mapOpen}>
        <div className="map-zoom" role="group" aria-label="Zoom">
          <button type="button" className="map-control" aria-label="Zoom in" onClick={() => map?.zoomIn()}>
            <Icon name="plus" weight="bold" size={16} />
          </button>
          <button type="button" className="map-control" aria-label="Zoom out" onClick={() => map?.zoomOut()}>
            <Icon name="minus" weight="bold" size={16} />
          </button>
        </div>
        <button
          type="button"
          className="map-control map-control-solo"
          aria-label="Find my location"
          aria-busy={locating}
          onClick={locate}
        >
          <Icon name="crosshair" weight="bold" size={16} />
        </button>
      </div>
      <button type="button" className="avatar avatar-fab" aria-label="Plan my day" onClick={onChatOpen}>
        <svg viewBox="0 0 96 96" aria-hidden="true">
          <path fill="currentColor" d="M1.107 0h55.354v34.596H1.107zm60.297 0H67c16.016 0 29 12.984 29 29v65.893H61.404V0Z" />
          <circle cx="28.725" cy="67.275" r="28.725" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}
