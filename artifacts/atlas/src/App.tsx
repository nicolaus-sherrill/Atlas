import { useState, useCallback, useEffect } from "react";
import MapView from "@/components/MapView";
import Sidebar from "@/components/Sidebar";
import SpotForm from "@/components/SpotForm";
import BrowseView from "@/components/BrowseView";
import { getAllSpots, addSpot, updateSpot } from "@/lib/store";
import { generateSummary } from "@/lib/ai";
import type { WorkSpot } from "@/lib/types";

type AppView = "browse" | "map";

function App() {
  const [spots, setSpots] = useState<WorkSpot[]>(() => getAllSpots());
  const [view, setView] = useState<AppView>("browse");
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (isFormOpen) {
      setPendingLocation({ lat, lng });
    }
  }, [isFormOpen]);

  const handleSpotSelect = useCallback((id: string | null) => {
    setSelectedSpotId(id);
    if (id) {
      setView("map");
    }
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  const handleBrowseSpotSelect = useCallback((id: string) => {
    setSelectedSpotId(id);
    setView("map");
    setSidebarOpen(true);
  }, []);

  const handleAddClick = () => {
    if (view === "browse") {
      setView("map");
      setIsFormOpen(true);
      setSelectedSpotId(null);
      return;
    }
    if (isFormOpen) {
      setIsFormOpen(false);
      setPendingLocation(null);
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
    setSelectedSpotId(newSpot.id);

    if (newSpot.description) {
      const summary = await generateSummary(newSpot);
      if (summary) {
        updateSpot(newSpot.id, { aiSummary: summary });
        setSpots(getAllSpots());
      }
    }
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setPendingLocation(null);
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

  if (view === "browse") {
    return (
      <BrowseView
        spots={spots}
        onSpotSelect={handleBrowseSpotSelect}
        onAddClick={handleAddClick}
        onMapView={() => {
          setView("map");
          setSidebarOpen(true);
        }}
      />
    );
  }

  return (
    <div className="app-layout">
      {!sidebarOpen && (
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open sidebar"
        >
          &#9654;
        </button>
      )}

      <div className={`sidebar-container ${sidebarOpen ? "open" : "closed"}`}>
        <Sidebar
          spots={spots}
          onSpotSelect={handleSpotSelect}
          selectedSpotId={selectedSpotId}
          onAddClick={handleAddClick}
          isFormOpen={isFormOpen}
          onClose={() => setSidebarOpen(false)}
          onBackToBrowse={() => {
            setView("browse");
            setSelectedSpotId(null);
            setIsFormOpen(false);
            setPendingLocation(null);
          }}
        />
      </div>

      <div className="map-container">
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
            onSubmit={handleSubmit}
            onCancel={handleFormCancel}
          />
        )}
      </div>
    </div>
  );
}

export default App;
