import { useState } from "react";
import type { WorkSpot, Category, GoodFor, TagId, CategoryScores } from "@/lib/types";
import { missingCriteria } from "@/lib/types";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import type { GeocodingResult } from "@/lib/geocode";
import PlaceLinkCard from "@/components/PlaceLinkCard";
import { usePlaceLink } from "@/hooks/use-place-link";
import ModalShell from "./ModalShell";
import RatingRows from "./RatingRows";
import { GoodForPicker, INCLUSION_TEST, CategoryPicker, PaidEntryPicker, TagPicker } from "./SpotFormFields";

interface BrowseSubmitModalProps {
  // The spots already on the map, so a place that's there can take a rating instead of a copy
  spots: WorkSpot[];
  onSubmit: (spot: Omit<WorkSpot, "id" | "submittedAt">) => void;
  // A place already on the map: the rating, and the notes as a review
  onAddToExisting: (spot: WorkSpot, scores: CategoryScores, notes: string) => void;
  onClose: () => void;
}

type StepId = "place" | "what" | "rate" | "details";
const STEP_TITLES: Record<StepId, string> = { place: "The place", what: "What it is", rate: "Rate it", details: "Details" };

// Adding a spot, in four steps: where it is, what it is, the adder's rating, then tags and notes.
// A spot never reaches the map without a rating, so the rating is a step here, not an afterthought.
// A place already on the map skips "What it is" and the tags: it keeps what it is, and the adder's
// rating and notes are added to it.
export default function BrowseSubmitModal({ spots, onSubmit, onAddToExisting, onClose }: BrowseSubmitModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  // What's typed in the one search field, which finds a place by name or by address
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [goodFor, setGoodFor] = useState<GoodFor[]>([]);
  const [paidEntry, setPaidEntry] = useState(false);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [description, setDescription] = useState("");
  const [scores, setScores] = useState<CategoryScores>({});
  const [selectedTags, setSelectedTags] = useState<Set<TagId>>(new Set());

  const { link, select, clear } = usePlaceLink((details) => {
    if (details.category) setCategory(details.category);
    if (details.paidEntry) setPaidEntry(true);
    if (details.suggestedTags.length) setSelectedTags((prev) => new Set([...prev, ...details.suggestedTags]));
  });

  // Picking a result from the search: a named place fills in its name, and an address alone leaves
  // the name to the contributor
  const handlePick = (result: GeocodingResult) => {
    setQuery(result.name ?? result.address ?? result.displayName);
    setName(result.name ?? "");
    setAddress(result.address || result.displayName);
    setCity(result.city);
    setLocation({ lat: result.lat, lng: result.lng });
    if (result.category) setCategory(result.category);
    if (result.place) select(result.place, result.name ?? "");
    else clear();
  };

  // Typing again after a pick starts the search over
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (location) {
      setLocation(null);
      setName("");
      setAddress("");
      setCity("");
      clear();
    }
  };

  const existing = link
    ? spots.find((s) => s.osmType === link.place.osmType && s.osmId === link.place.osmId) ?? null
    : null;
  const steps: StepId[] = existing ? ["place", "rate", "details"] : ["place", "what", "rate", "details"];
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const last = stepIndex >= steps.length - 1;

  const toggleTag = (tagId: TagId) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  // What a rating must cover follows from what the place is: the one already on the map, or the
  // category and good-for chosen here
  const place = existing ? { category: existing.category, goodFor: existing.goodFor } : category ? { category, goodFor } : null;
  const missing = place ? missingCriteria(place, scores) : [];
  // Whether this step is done. The steps say what they need themselves, so no line of copy repeats it.
  const blocked = {
    place: !location || !name.trim(),
    what: !category || goodFor.length === 0,
    rate: missing.length > 0,
    details: false,
  }[step];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked) return;
    if (!last) {
      setStepIndex(stepIndex + 1);
      return;
    }
    if (existing) {
      onAddToExisting(existing, scores, description);
      return;
    }
    if (!location || !category) return;
    const details = link && !link.loading ? link.details : null;

    onSubmit({
      name: name.trim(),
      category,
      goodFor,
      paidEntry,
      city: city || "Unknown",
      address: address.trim() || "No address provided",
      lat: location.lat,
      lng: location.lng,
      scores,
      tags: Array.from(selectedTags),
      description: description.trim(),
      operatingHours: details?.operatingHours,
      website: details?.website,
      osmType: link?.place.osmType,
      osmId: link?.place.osmId,
    });
  };

  return (
    <ModalShell
      title="Add a spot"
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <div className="modal-steps-actions">
            {stepIndex > 0 && (
              <button type="button" className="btn-outline" onClick={() => setStepIndex(stepIndex - 1)}>
                Back
              </button>
            )}
            <button type="submit" className="btn-submit" disabled={blocked}>
              {last ? (existing ? "Add rating" : "Add spot") : "Next"}
            </button>
          </div>
        </>
      }
    >
      <p className="modal-step" aria-live="polite">
        <span className="filter-label">
          Step {stepIndex + 1} of {steps.length}
        </span>
        <span className="modal-step-title">{STEP_TITLES[step]}</span>
      </p>

      {step === "place" && (
        <>
          <p className="modal-intro">{INCLUSION_TEST}</p>
          <div className="form-group">
            <label htmlFor="browse-search">Name or address</label>
            <AddressAutocomplete
              id="browse-search"
              mode="any"
              value={query}
              onChange={handleQueryChange}
              onSelect={handlePick}
              placeholder="Search by name or address"
              autoFocus
            />
            {link && !existing && <PlaceLinkCard link={link} onClear={clear} />}
          </div>

          {/* An address on its own has no name to borrow, so the contributor gives one */}
          {location && !link && (
            <div className="form-group">
              <label htmlFor="browse-name">Name</label>
              <input id="browse-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="What's the place called?" autoComplete="off" />
            </div>
          )}

          {location && (
            <div className="form-group">
              <label>Address</label>
              <div className="city-display">{address}</div>
            </div>
          )}

          {existing && (
            <p className="modal-hint" role="status">
              {existing.name} is already on Atlas. Your rating and notes will be added to it.
            </p>
          )}
        </>
      )}

      {step === "what" && (
        <>
          <div className="form-group">
            <label>Category</label>
            <CategoryPicker value={category} onChange={setCategory} />
          </div>
          <div className="form-group">
            <label>Good for</label>
            <GoodForPicker value={goodFor} onChange={setGoodFor} />
          </div>
          <div className="form-group">
            <label>Entry</label>
            <PaidEntryPicker value={paidEntry} onChange={setPaidEntry} />
          </div>
        </>
      )}

      {step === "rate" && place && (
        <div className="form-group">
          <label>Your rating</label>
          <RatingRows place={place} scores={scores} onChange={setScores} />
        </div>
      )}

      {step === "details" && (
        <>
          {!existing && (
            <div className="form-group">
              <TagPicker value={Array.from(selectedTags)} onToggle={toggleTag} />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="browse-description">{existing ? "Your review (optional)" : "Notes (optional)"}</label>
            <textarea
              id="browse-description"
              placeholder="What should someone know before they go?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </>
      )}
    </ModalShell>
  );
}
