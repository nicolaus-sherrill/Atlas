import { useState, useCallback, useEffect } from "react";
import MapView from "@/components/MapView";
import Sidebar from "@/components/Sidebar";
import SpotForm from "@/components/SpotForm";
import BrowseView from "@/components/BrowseView";
import ChatPanel from "@/components/ChatPanel";
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

  const toggleMap = useCallback(() => {
    setMapOpen((prev) => !prev);
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

  const handleGeocode = useCallback((lat: number, lng: number, address: string, city: string) => {
    setPendingLocation({ lat, lng });
    setPendingGeoData({ address, city });
    if (!isFormOpen) {
      setIsFormOpen(true);
      setSelectedSpotId(null);
    }
  }, [isFormOpen]);

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
    <div className={`app-shell ${mapOpen ? "map-open" : "map-closed"}`}>
      <div className="panel-left">
        {mapOpen ? (
          <Sidebar
            spots={spots}
            onSpotSelect={handleSpotSelect}
            selectedSpotId={selectedSpotId}
            onAddClick={handleAddClick}
            isFormOpen={isFormOpen}
            onGeocode={handleGeocode}
            onDeleteSpot={isAdmin ? handleDeleteSpot : undefined}
            onChatOpen={() => setIsChatOpen(true)}
          />
        ) : (
          <BrowseView
            spots={spots}
            onSpotSelect={handleBrowseSpotSelect}
            onAddClick={handleAddClick}
            onBrowseSubmit={handleSubmit}
            onRated={reloadSpots}
            onNotice={setNotice}
            onChatOpen={() => setIsChatOpen(true)}
            onDeleteSpot={isAdmin ? handleDeleteSpot : undefined}
          />
        )}
      </div>

      <div className="panel-right">
        <MapView
          spots={spots}
          selectedSpotId={selectedSpotId}
          onMapClick={handleMapClick}
          onSpotSelect={handleSpotSelect}
          pendingLocation={pendingLocation}
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

      <button
        className="map-toggle-fab"
        onClick={toggleMap}
        aria-label={mapOpen ? "Hide map" : "Show map"}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {mapOpen ? (
            <polyline points="15 18 9 12 15 6" />
          ) : (
            <polyline points="9 18 15 12 9 6" />
          )}
        </svg>
      </button>

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
