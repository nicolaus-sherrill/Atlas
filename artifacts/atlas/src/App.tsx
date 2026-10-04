import { useState, useCallback, useEffect, useRef } from "react";
import MapView from "@/components/MapView";
import Sidebar from "@/components/Sidebar";
import BrowseSubmitModal from "@/components/BrowseSubmitModal";
import BrowseView from "@/components/BrowseView";
import ChatPanel from "@/components/ChatPanel";
import Icon from "@/components/Icon";
import MapControls from "@/components/MapControls";
import SpotDetails from "@/components/SpotDetails";
import { clearArea, type ClearArea } from "@/lib/camera";
import { fetchAllCrowdStatuses, type CrowdStatus } from "@/lib/crowd";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useTheme } from "@/hooks/use-theme";
import ThemeToggle from "@/components/ThemeToggle";
import { useBottomSheet, detentHeights, type Detent } from "@/hooks/use-bottom-sheet";
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
  // The selected spot and where it was picked, which decides how the camera answers
  const [selection, setSelection] = useState<{ id: string; source: "list" | "marker"; seq: number } | null>(null);
  const selectedSpotId = selection?.id ?? null;
  const select = useCallback((id: string | null, source: "list" | "marker" = "list") => {
    setSelection((prev) => (id ? { id, source, seq: (prev?.seq ?? 0) + 1 } : null));
  }, []);
  // Details open in a second sheet at 1280 and wider (B), and in place of the list below that (A)
  const isWide = useMediaQuery("(min-width: 1280px)");
  const isPhone = useMediaQuery("(max-width: 768px)");
  const { theme, toggle: toggleTheme } = useTheme();
  const themeToggle = <ThemeToggle theme={theme} onToggle={toggleTheme} />;
  // On a phone the map is always showing and the list is a bottom sheet over it, so there is no
  // table state: showMap is the map state on desktop and always true on a phone
  const showMap = mapOpen || isPhone;
  const [detent, setDetent] = useState<Detent>("half");
  const shellRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const { grabProps, onHandleKeyDown } = useBottomSheet({ shellRef, sheetRef, detent, onDetentChange: setDetent });
  const [crowdStatuses, setCrowdStatuses] = useState<Record<string, CrowdStatus>>({});
  const reloadCrowd = useCallback(() => {
    fetchAllCrowdStatuses().then(setCrowdStatuses);
  }, []);
  useEffect(() => {
    reloadCrowd();
  }, [reloadCrowd]);
  // Add a spot is a modal over whichever view is showing, so adding never switches you to the map
  const [isAddOpen, setIsAddOpen] = useState(false);
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

  // A row in the map list, or "View on map" from the table
  const handleListSelect = useCallback((id: string) => {
    select(id, "list");
    setMapOpen(true);
  }, [select]);

  // Closing the chat hands focus back to its button
  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    requestAnimationFrame(() => (document.querySelector(".avatar-fab") as HTMLElement | null)?.focus());
  }, []);

  // A spot the agent recommended opens on the map. On a phone the chat covers the map, so it closes
  const handleChatSpotSelect = useCallback((id: string) => {
    handleListSelect(id);
    if (isPhone) closeChat();
  }, [handleListSelect, isPhone, closeChat]);

  const handleMarkerSelect = useCallback((id: string) => {
    select(id, "marker");
  }, [select]);

  // A pick or a search lifts a peeking sheet, so what it opened has room to show
  useEffect(() => {
    if (isPhone && (selection || query.trim())) setDetent((d) => (d === "peek" ? "half" : d));
  }, [isPhone, selection, query]);

  // The last spot shown stays in the sheet while it slides away
  const detailsSpot = spots.find((s) => s.id === selectedSpotId) ?? null;
  const lastDetailsSpot = useRef<typeof detailsSpot>(null);
  if (detailsSpot) lastDetailsSpot.current = detailsSpot;
  const detailsOpen = showMap && !!detailsSpot;
  const sheetOpen = detailsOpen && isWide;
  // The list steps aside for the details under A, which take its place in the card
  const listCovered = detailsOpen && !isWide;

  // Closing the details hands focus back to the spot's row, so the keyboard keeps its place. It
  // waits for the commit, when the list is no longer inert and can take focus.
  const returnFocusTo = useRef<string | null>(null);
  const closeDetails = useCallback(() => {
    returnFocusTo.current = selectedSpotId;
    select(null);
  }, [select, selectedSpotId]);
  useEffect(() => {
    const id = returnFocusTo.current;
    if (selectedSpotId || !id) return;
    returnFocusTo.current = null;
    (document.querySelector(`.pane-map [data-spot-id="${CSS.escape(id)}"]`) as HTMLElement | null)?.focus();
  }, [selectedSpotId]);

  useEffect(() => {
    if (!detailsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      // A modal or the chat over the details takes Escape for itself
      if (e.key === "Escape" && !document.querySelector(".browse-modal-backdrop, .chat-card")) closeDetails();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [detailsOpen, closeDetails]);

  // The part of the map the cards leave clear, at rest. On desktop it follows from the state, so the
  // camera can move while a card is still sliding; on a phone the card is measured.
  const getClearArea = useCallback((m: L.Map): ClearArea => {
    const size = m.getSize();
    if (isPhone) {
      // Under the floating search and chips, above the sheet at its resting detent
      const chips = document.querySelector(".sidebar-categories")?.getBoundingClientRect().bottom ?? 0;
      const shell = shellRef.current;
      const sheet = shell ? detentHeights(shell)[detent] : 0;
      return { left: 0, top: chips, right: size.x, bottom: size.y - sheet };
    }
    const card = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--shell-card-width")) || 380;
    const left = !mapOpen ? 0 : sheetOpen ? card * 2 : card;
    return { left, top: 0, right: size.x, bottom: size.y };
  }, [isPhone, mapOpen, sheetOpen, detent]);

  // Resolves true when the spot saved, so a form can stay open (keeping what was typed) on failure
  const handleSubmit = async (spot: Omit<WorkSpot, "id" | "submittedAt">): Promise<boolean> => {
    try {
      const newSpot = await addSpot(spot);
      setSpots((prev) => [newSpot, ...prev]);
      setIsAddOpen(false);
      select(newSpot.id);
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
      if (selectedSpotId === id) select(null);
    } catch {
      setNotice("Couldn't remove that spot.");
    }
  }, [selectedSpotId, select]);

  return (
    <div ref={shellRef} className={`app-shell ${showMap ? "map-open" : "map-closed"}`} data-detent={isPhone ? detent : undefined}>
      {/* The map is always mounted, under the list card, so switching views never rebuilds it */}
      <div className="shell-map">
        <MapView
          spots={spots}
          selection={selection}
          centreEveryPick={!isWide}
          getClearArea={getClearArea}
          onMarkerSelect={handleMarkerSelect}
          cameraTarget={cameraTarget}
          onReady={setMap}
          theme={theme}
        />
      </div>

      {/* B, at 1280 and wider: the details slide out from under the list card as a second sheet */}
      {isWide && (
        <aside className={`details-sheet${sheetOpen ? " open" : ""}`} aria-label="Spot details" inert={!sheetOpen}>
          <div className="details-scroll">
            {lastDetailsSpot.current && (
              <SpotDetails
                spot={lastDetailsSpot.current}
                dismiss="close"
                onDismiss={closeDetails}
                crowdStatus={crowdStatuses[lastDetailsSpot.current.id] ?? null}
                onRated={reloadSpots}
                onCrowdReported={reloadCrowd}
                onNotice={setNotice}
                onDelete={isAdmin ? handleDeleteSpot : undefined}
              />
            )}
          </div>
        </aside>
      )}

      {/* One card over the map: the table at full width, the list at 380px, and a bottom sheet on a phone */}
      <aside ref={sheetRef} className="list-card" aria-label="Spots">
        {/* On a phone the card is a bottom sheet: this is where it is dragged from */}
        {isPhone && (
          <div className="sheet-grab" {...grabProps}>
            <button
              type="button"
              className="sheet-handle"
              aria-label={`Resize the list, now ${detent === "peek" ? "lowered" : detent === "half" ? "halfway" : "full"}`}
              onKeyDown={onHandleKeyDown}
            >
              <span aria-hidden="true" />
            </button>
          </div>
        )}
        <header className="list-card-head">
          <div className="list-card-brand">
            <svg width="24" height="24" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path fill="currentColor" d="M1.107 0h55.354v34.596H1.107zm60.297 0H67c16.016 0 29 12.984 29 29v65.893H61.404V0Z"/>
              <circle cx="28.725" cy="67.275" r="28.725" fill="currentColor"/>
            </svg>
            <h1>Atlas</h1>
          </div>
          <div className="list-card-actions">
            <div className="segmented" role="group" aria-label="View">
              <button type="button" data-shell-view="table" aria-pressed={!mapOpen} onClick={() => setMapOpen(false)}>
                <Icon name="rows" weight="bold" size={16} />
                List
              </button>
              <button type="button" data-shell-view="map" aria-pressed={mapOpen} onClick={() => setMapOpen(true)}>
                <Icon name="map-trifold" weight="bold" size={16} />
                Map
              </button>
            </div>
            <button
              type="button"
              className="btn-outline list-card-add"
              aria-label="Add a spot"
              onClick={() => setIsAddOpen(true)}
            >
              <Icon name="plus" weight="bold" size={16} />
              <span className="list-card-add-label">Add a spot</span>
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
          <div className="list-card-pane pane-table" inert={showMap}>
            <BrowseView
              spots={spots}
              onSpotSelect={handleListSelect}
              onRated={reloadSpots}
              onNotice={setNotice}
              crowdStatuses={crowdStatuses}
              onCrowdReported={reloadCrowd}
              onDeleteSpot={isAdmin ? handleDeleteSpot : undefined}
              query={query}
              places={places}
              placesLoading={placesLoading}
              onPickPlace={handlePickPlace}
              themeToggle={themeToggle}
            />
          </div>
          <div className="list-card-pane pane-map" inert={!showMap}>
            {/* The list, the details (A, below 1280) and the add form take turns here. The list is
                only hidden while the others show, so its scroll is there when you come back */}
            <div className={`pane-layer pane-list${listCovered ? " is-hidden" : ""}`} inert={listCovered}>
              <Sidebar
                spots={spots}
                onSpotSelect={handleListSelect}
                selectedSpotId={selectedSpotId}
                onAddClick={() => setIsAddOpen(true)}
                query={query}
                places={places}
                placesLoading={placesLoading}
                onPickPlace={handlePickPlace}
                themeToggle={themeToggle}
              />
            </div>
            {!isWide && detailsSpot && (
              <div className="pane-layer details-scroll" key={detailsSpot.id}>
                <SpotDetails
                  spot={detailsSpot}
                  dismiss="back"
                  onDismiss={closeDetails}
                  crowdStatus={crowdStatuses[detailsSpot.id] ?? null}
                  onRated={reloadSpots}
                  onCrowdReported={reloadCrowd}
                  onNotice={setNotice}
                  onDelete={isAdmin ? handleDeleteSpot : undefined}
                />
              </div>
            )}
          </div>
        </div>
      </aside>

      <MapControls map={map} mapOpen={showMap} chatOpen={isChatOpen} onChatToggle={() => (isChatOpen ? closeChat() : setIsChatOpen(true))} onNotice={setNotice} />

      {notice && (
        <div className="app-notice" role="status" onClick={() => setNotice(null)}>
          {notice}
        </div>
      )}

      {isAddOpen && (
        <BrowseSubmitModal
          onSubmit={async (spot) => {
            await handleSubmit(spot);
          }}
          onClose={() => setIsAddOpen(false)}
        />
      )}

      {isChatOpen && <ChatPanel spots={spots} onSpotSelect={handleChatSpotSelect} onClose={closeChat} />}
    </div>
  );
}

export default App;
