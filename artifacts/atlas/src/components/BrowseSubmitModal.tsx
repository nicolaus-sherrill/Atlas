import { useState } from "react";
import type { WorkSpot, Category, GoodFor, TagId, CategoryScores } from "@/lib/types";
import { SCORE_CATEGORY_LABELS, missingCriteria } from "@/lib/types";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import type { GeocodingResult } from "@/lib/geocode";
import PlaceLinkCard from "@/components/PlaceLinkCard";
import { usePlaceLink } from "@/hooks/use-place-link";
import ModalShell from "./ModalShell";
import RatingRows from "./RatingRows";
import { GoodForPicker, INCLUSION_TEST, CategoryPicker, PaidEntryPicker, TagPicker } from "./SpotFormFields";

interface BrowseSubmitModalProps {
  onSubmit: (spot: Omit<WorkSpot, "id" | "submittedAt">) => void;
  onClose: () => void;
}

const STEPS = ["The place", "What it is", "Rate it", "Details"] as const;

// Adding a spot, in four steps: where it is, what it is, the adder's rating, then tags and notes.
// A spot never reaches the map without a rating, so the rating is a step here, not an afterthought.
export default function BrowseSubmitModal({ onSubmit, onClose }: BrowseSubmitModalProps) {
  const [step, setStep] = useState(0);
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

  const handleNameSelect = (result: GeocodingResult) => {
    setName(result.name ?? result.displayName);
    setAddress(result.address);
    setCity(result.city);
    setLocation({ lat: result.lat, lng: result.lng });
    if (result.category) setCategory(result.category);
    if (result.place) select(result.place, result.name ?? "");
    else clear();
  };

  const handleAddressSelect = (result: GeocodingResult) => {
    setAddress(result.address || result.displayName);
    setCity(result.city);
    setLocation({ lat: result.lat, lng: result.lng });
  };

  const toggleTag = (tagId: TagId) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const place = category ? { category, goodFor } : null;
  const missing = place ? missingCriteria(place, scores) : [];
  // What still stands between this step and the next, said in words under the button
  const blocker = [
    !name.trim() ? "Give the place a name." : !location ? "Pick the place from the suggestions, or choose an address, so Atlas knows where it is." : null,
    !category ? "Choose a category." : goodFor.length === 0 ? "Choose at least one thing it's good for." : null,
    missing.length > 0 ? `Still to rate: ${missing.map((k) => SCORE_CATEGORY_LABELS[k].toLowerCase()).join(", ")}.` : null,
    null,
  ][step];

  const last = step === STEPS.length - 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (blocker) return;
    if (!last) {
      setStep(step + 1);
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
          {blocker && <p className="modal-hint">{blocker}</p>}
          <div className="modal-steps-actions">
            {step > 0 && (
              <button type="button" className="btn-outline" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            <button type="submit" className="btn-submit" disabled={!!blocker}>
              {last ? "Add spot" : "Next"}
            </button>
          </div>
        </>
      }
    >
      <p className="modal-step" aria-live="polite">
        <span className="filter-label">
          Step {step + 1} of {STEPS.length}
        </span>
        <span className="modal-step-title">{STEPS[step]}</span>
      </p>

      {step === 0 && (
        <>
          <p className="modal-intro">{INCLUSION_TEST}</p>
          <div className="form-group">
            <label htmlFor="browse-name">Name</label>
            <AddressAutocomplete
              id="browse-name"
              mode="place"
              value={name}
              onChange={setName}
              onSelect={handleNameSelect}
              placeholder="Start typing the place's name"
              autoFocus
            />
            {link && <PlaceLinkCard link={link} onClear={clear} />}
          </div>

          <div className="form-group">
            <label htmlFor="browse-address">Address</label>
            <AddressAutocomplete id="browse-address" value={address} onChange={setAddress} onSelect={handleAddressSelect} placeholder="123 Main St, Austin, TX" />
          </div>

          {city && (
            <div className="form-group">
              <label>City</label>
              <div className="city-display">{city}</div>
            </div>
          )}
        </>
      )}

      {step === 1 && (
        <>
          <div className="form-group">
            <label>Category</label>
            <CategoryPicker value={category} onChange={setCategory} />
          </div>
          <div className="form-group">
            <label>Good for</label>
            <p className="modal-hint">Pick everything that fits.</p>
            <GoodForPicker value={goodFor} onChange={setGoodFor} />
          </div>
          <div className="form-group">
            <label>Entry</label>
            <p className="modal-hint">Paid entry means a ticket or a day pass. Buying a coffee doesn't count.</p>
            <PaidEntryPicker value={paidEntry} onChange={setPaidEntry} />
          </div>
        </>
      )}

      {step === 2 && place && (
        <div className="form-group">
          <label>Your rating</label>
          <RatingRows place={place} scores={scores} onChange={setScores} />
          <p className="modal-hint">Hours aren't rated. Atlas scores them from the opening hours.</p>
        </div>
      )}

      {step === 3 && (
        <>
          <div className="form-group">
            <label>Tags</label>
            <TagPicker value={Array.from(selectedTags)} onToggle={toggleTag} />
          </div>
          <div className="form-group">
            <label htmlFor="browse-description">Notes (optional)</label>
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
