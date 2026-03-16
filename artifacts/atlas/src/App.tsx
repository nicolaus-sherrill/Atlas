import { useState, useCallback } from "react";
import MapView from "@/components/MapView";
import Sidebar from "@/components/Sidebar";
import SpotForm from "@/components/SpotForm";
import { getAllSpots, addSpot } from "@/lib/store";
import type { WorkSpot } from "@/lib/types";

function App() {
  const [spots, setSpots] = useState<WorkSpot[]>(() => getAllSpots());
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
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  const handleAddClick = () => {
    if (isFormOpen) {
      setIsFormOpen(false);
      setPendingLocation(null);
    } else {
      setIsFormOpen(true);
      setSelectedSpotId(null);
    }
  };

  const handleSubmit = (spot: Omit<WorkSpot, "id" | "submittedAt">) => {
    const newSpot = addSpot(spot);
    setSpots(getAllSpots());
    setIsFormOpen(false);
    setPendingLocation(null);
    setSelectedSpotId(newSpot.id);
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setPendingLocation(null);
  };

  return (
    <div className="app-layout">
      {!sidebarOpen && (
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open sidebar"
        >
          ▶
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
