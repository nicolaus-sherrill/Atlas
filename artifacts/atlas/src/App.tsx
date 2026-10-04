import { useState, useCallback, useEffect } from "react";
import MapView from "@/components/MapView";
import Sidebar from "@/components/Sidebar";
import SpotForm from "@/components/SpotForm";
import BrowseView from "@/components/BrowseView";
import ChatPanel from "@/components/ChatPanel";
import Icon from "@/components/Icon";
import MapControls from "@/components/MapControls";
import type L from "leaflet";
import { usePlaceSearch } from "@/hooks/use-place-search";
import type { GeocodingResult } from "@/lib/geocode";
import { fetchSpots, addSpot, removeSpot, requestSummary, DuplicatePlaceError } from "@/lib/store";
import { useIsAdmin } from "@/lib/admin";
import type { WorkSpot } from "@/lib/types";

function App() {
  const [spots, setSpots] = useState<WorkSpot[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const isAdmin = useIsAdmin();

  const reloadSpots = useCallback(async () => {
    try {
      setSpots(await fetchSpots());
    } catch {
      setNotice("Couldn't load spots. Check your connection and refresh.");
    }
  }, []);

  useEffect(() => {
    reloadSpots();
  }, [reloadSpots]);
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingGeoData, setPendingGeoData] = useState<{ address: string; city: string } | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [map, setMap] = useState<L.Map | null>(null);
  const { places, loading: placesLoading } = usePlaceSearch(query);
  // Where the camera goes next; seq makes picking the same place twice still move it
  const [cameraTarget, setCameraTarget] = useState<{ lat: number; lng: number; seq: number } | null>(null);

  // A place from the search pans the map there, opening the map if the table was showing
  const handlePickPlace = useCallback((place: GeocodingResult) => {
    setQuery("");
    setMapOpen(true);
    setCameraTarget((prev) => ({ lat: place.lat, lng: place.lng, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (isFormOpen) {
      setPendingLocation({ lat, lng });
      setPendingGeoData(null);
    }
  }, [isFormOpen]);

  const handleSpotSelect = useCallback((id: string | null) => {
    setSelectedSpotId(id);
    if (id && !mapOpen) {
      setMapOpen(true);
    }
  }, [mapOpen]);

  const handleBrowseSpotSelect = useCallback((id: string) => {
    setSelectedSpotId(id);
    setMapOpen(true);
  }, []);

  const handleAddClick = () => {
    if (!mapOpen) {
      setMapOpen(true);
    }
    if (isFormOpen) {
      setIsFormOpen(false);
      setPendingLocation(null);
      setPendingGeoData(null);
    } else {
      setIsFormOpen(true);
      setSelectedSpotId(null);
    }
  };

  // Resolves true when the spot saved, so a form can stay open (keeping what was typed) on failure
  const handleSubmit = async (spot: Omit<WorkSpot, "id" | "submittedAt">): Promise<boolean> => {
    try {
      const newSpot = await addSpot(spot);
      setSpots((prev) => [newSpot, ...prev]);
      setIsFormOpen(false);
      setPendingLocation(null);
      setPendingGeoData(null);
      setSelectedSpotId(newSpot.id);
      if (newSpot.description) {
        requestSummary(newSpot.id).then((wrote) => {
          if (wrote) reloadSpots();
        });
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setNotice(
        err instanceof DuplicatePlaceError
          ? "That place is already on Atlas. Search the list to find it."
          : message.includes("Too many")
            ? "You've added a lot of spots this hour. Try again a little later."
            : "Couldn't save that spot. Check the details and try again.",
      );
      return false;
    }
  };

  const handleDeleteSpot = useCallback(async (id: string) => {
    try {
      await removeSpot(id);
      setSpots((prev) => prev.filter((s) => s.id !== id));
      if (selectedSpotId === id) {
        setSelectedSpotId(null);
      }
    } catch {
      setNotice("Couldn't remove that spot.");
    }
  }, [selectedSpotId]);

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setPendingLocation(null);
    setPendingGeoData(null);
  };

  return (
    <div className={`app-shell ${mapOpen ? "map-open" : "map-closed"}${query.trim() ? " has-query" : ""}`}>
      {/* The map is always mounted, under the list card, so switching views never rebuilds it */}
      <div className="shell-map">
        <MapView
          spots={spots}
          selectedSpotId={selectedSpotId}
          onMapClick={handleMapClick}
          onSpotSelect={handleSpotSelect}
          pendingLocation={pendingLocation}
          cameraTarget={cameraTarget}
          onReady={setMap}
        />

        {isFormOpen && (
          <SpotForm
            pendingLocation={pendingLocation}
            geoData={pendingGeoData}
            onSubmit={handleSubmit}
            onCancel={handleFormCancel}
            onLocationChange={(lat, lng) => {
              setPendingLocation({ lat, lng });
              setPendingGeoData(null);
            }}
          />
        )}
      </div>

      {/* One card over the map: the table at full width, the list at 380px */}
      <aside className="list-card" aria-label="Spots">
        <header className="list-card-head">
          <div className="list-card-brand">
            <svg width="24" height="24" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path fill="currentColor" d="M1.107 0h55.354v34.596H1.107zm60.297 0H67c16.016 0 29 12.984 29 29v65.893H61.404V0Z"/>
              <circle cx="28.725" cy="67.275" r="28.725" fill="currentColor"/>
            </svg>
            <h1>Atlas</h1>
          </div>
          <div className="segmented" role="group" aria-label="View">
            <button type="button" data-shell-view="table" aria-pressed={!mapOpen} onClick={() => setMapOpen(false)}>
              <Icon name="rows" weight="bold" size={16} />
              Table
            </button>
            <button type="button" data-shell-view="map" aria-pressed={mapOpen} onClick={() => setMapOpen(true)}>
              <Icon name="map-trifold" weight="bold" size={16} />
              Map
            </button>
          </div>
        </header>

        <div className="shell-search" role="search">
          <Icon name="magnifying-glass" weight="bold" size={16} />
          <input
            type="search"
            placeholder="Search spots or places"
            aria-label="Search spots or places"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Both bodies stay mounted, so each keeps its filters and scroll; the hidden one is inert */}
        <div className="list-card-body">
          <div className="list-card-pane pane-table" inert={mapOpen}>
            <BrowseView
              spots={spots}
              onSpotSelect={handleBrowseSpotSelect}
              onAddClick={handleAddClick}
              onBrowseSubmit={handleSubmit}
              onRated={reloadSpots}
              onNotice={setNotice}
              onChatOpen={() => setIsChatOpen(true)}
              onDeleteSpot={isAdmin ? handleDeleteSpot : undefined}
              query={query}
              places={places}
              placesLoading={placesLoading}
              onPickPlace={handlePickPlace}
            />
          </div>
          <div className="list-card-pane pane-map" inert={!mapOpen}>
            <Sidebar
              spots={spots}
              onSpotSelect={handleSpotSelect}
              selectedSpotId={selectedSpotId}
              onAddClick={handleAddClick}
              isFormOpen={isFormOpen}
              query={query}
              places={places}
              placesLoading={placesLoading}
              onPickPlace={handlePickPlace}
              onDeleteSpot={isAdmin ? handleDeleteSpot : undefined}
              onChatOpen={() => setIsChatOpen(true)}
            />
          </div>
        </div>
      </aside>

      <MapControls map={map} mapOpen={mapOpen} onChatOpen={() => setIsChatOpen(true)} onNotice={setNotice} />

      {notice && (
        <div className="app-notice" role="status" onClick={() => setNotice(null)}>
          {notice}
        </div>
      )}

      {isChatOpen && (
        <ChatPanel spots={spots} onClose={() => setIsChatOpen(false)} />
      )}
    </div>
  );
}

export default App;
