import { useState, useCallback, useEffect } from "react";
import MapView from "@/components/MapView";
import Sidebar from "@/components/Sidebar";
import SpotForm from "@/components/SpotForm";
import BrowseView from "@/components/BrowseView";
import ChatPanel from "@/components/ChatPanel";
import { getAllSpots, addSpot, updateSpot, deleteSpot } from "@/lib/store";
import { generateSummary } from "@/lib/ai";
import type { WorkSpot } from "@/lib/types";

function App() {
  const [spots, setSpots] = useState<WorkSpot[]>(() => getAllSpots());
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

  const handleSubmit = async (spot: Omit<WorkSpot, "id" | "submittedAt">) => {
    const newSpot = addSpot(spot);
    setSpots(getAllSpots());
    setIsFormOpen(false);
    setPendingLocation(null);
    setPendingGeoData(null);
    setSelectedSpotId(newSpot.id);

    if (newSpot.description) {
      const summary = await generateSummary(newSpot);
      if (summary) {
        updateSpot(newSpot.id, { aiSummary: summary });
        setSpots(getAllSpots());
      }
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

  const handleDeleteSpot = useCallback((id: string) => {
    deleteSpot(id);
    setSpots(getAllSpots());
    if (selectedSpotId === id) {
      setSelectedSpotId(null);
    }
  }, [selectedSpotId]);

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setPendingLocation(null);
    setPendingGeoData(null);
  };

  useEffect(() => {
    const spotsWithoutSummary = spots.filter((s) => s.description && !s.aiSummary);
    if (spotsWithoutSummary.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const spot of spotsWithoutSummary) {
        if (cancelled) break;
        const summary = await generateSummary(spot);
        if (summary && !cancelled) {
          updateSpot(spot.id, { aiSummary: summary });
          setSpots(getAllSpots());
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

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
            onDeleteSpot={handleDeleteSpot}
          />
        ) : (
          <BrowseView
            spots={spots}
            onSpotSelect={handleBrowseSpotSelect}
            onAddClick={handleAddClick}
            onBrowseSubmit={handleSubmit}
            onChatOpen={() => setIsChatOpen(true)}
            onDeleteSpot={handleDeleteSpot}
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

      {isChatOpen && (
        <ChatPanel spots={spots} onClose={() => setIsChatOpen(false)} />
      )}
    </div>
  );
}

export default App;
