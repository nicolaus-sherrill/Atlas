import { useMemo, useState } from "react";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import HoursEditor from "@/components/HoursEditor";
import { suggestEdit, type EditableFields } from "@/lib/contributions";
import type { GeocodingResult } from "@/lib/geocode";
import { CATEGORIES, TAGS, type TagId, type WorkSpot } from "@/lib/types";

interface SuggestEditModalProps {
  spot: WorkSpot;
  onClose: () => void;
  onSent: () => void;
}

function current(spot: WorkSpot): EditableFields {
  return {
    name: spot.name,
    category: spot.category,
    address: spot.address,
    city: spot.city,
    lat: spot.lat,
    lng: spot.lng,
    website: spot.website ?? "",
    description: spot.description,
    tags: [...spot.tags].sort(),
    operating_hours: spot.operatingHours ?? null,
  };
}

// Only the fields that differ from the spot as it stands are sent for review
function diff(before: EditableFields, after: EditableFields): Partial<EditableFields> {
  const changes: Partial<EditableFields> = {};
  for (const key of Object.keys(before) as (keyof EditableFields)[]) {
    const a = key === "tags" ? [...before.tags].sort() : before[key];
    const b = key === "tags" ? [...after.tags].sort() : after[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) (changes as Record<string, unknown>)[key] = after[key];
  }
  return changes;
}

export default function SuggestEditModal({ spot, onClose, onSent }: SuggestEditModalProps) {
  const original = useMemo(() => current(spot), [spot]);
  const [fields, setFields] = useState<EditableFields>(original);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof EditableFields>(key: K, value: EditableFields[K]) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const changes = diff(original, fields);
  const changedCount = Object.keys(changes).length;
  const websiteInvalid = fields.website !== "" && !/^https?:\/\/\S+\.\S+/i.test(fields.website);

  const toggleTag = (tag: TagId) =>
    set("tags", fields.tags.includes(tag) ? fields.tags.filter((t) => t !== tag) : [...fields.tags, tag]);

  const handleAddressSelect = (result: GeocodingResult) =>
    setFields((prev) => ({ ...prev, address: result.address || result.displayName, city: result.city || prev.city, lat: result.lat, lng: result.lng }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changedCount === 0 || websiteInvalid) return;
    setSending(true);
    setError(null);
    try {
      await suggestEdit(spot.id, changes, note);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that. Try again.");
      setSending(false);
    }
  };

  return (
    <div className="browse-modal-backdrop" onClick={onClose}>
      <div className="browse-modal" onClick={(e) => e.stopPropagation()}>
        <form className="spot-form" onSubmit={submit}>
          <div className="spot-form-header">
            <h2>Suggest an edit</h2>
            <button type="button" className="spot-form-close" onClick={onClose} aria-label="Close">
              &times;
            </button>
          </div>
          <p className="modal-intro">Change anything that's wrong about {spot.name}. An admin reviews every edit before it goes live.</p>

          <div className="form-group">
            <label htmlFor="edit-name">Name</label>
            <input id="edit-name" type="text" value={fields.name} maxLength={200} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="form-group">
            <label htmlFor="edit-address">Address</label>
            <AddressAutocomplete id="edit-address" value={fields.address} onChange={(v) => set("address", v)} onSelect={handleAddressSelect} />
            {changes.lat !== undefined || changes.lng !== undefined ? (
              <p className="modal-hint">The pin moves to this address.</p>
            ) : (
              changes.address !== undefined && <p className="modal-hint">Pick the address from the suggestions to move the pin too.</p>
            )}
          </div>

          <div className="form-group">
            <label>Category</label>
            <div className="category-select">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  className={`category-option ${fields.category === cat.value ? "active" : ""}`}
                  onClick={() => set("category", cat.value)}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Hours</label>
            <HoursEditor value={fields.operating_hours} onChange={(v) => set("operating_hours", v)} />
          </div>

          <div className="form-group">
            <label htmlFor="edit-website">Website</label>
            <input
              id="edit-website"
              type="url"
              placeholder="https://"
              value={fields.website}
              onChange={(e) => set("website", e.target.value.trim())}
            />
            {websiteInvalid && <p className="modal-error">Enter a full web address, starting with https://</p>}
          </div>

          <div className="form-group">
            <label>Tags</label>
            <div className="tag-chip-grid">
              {TAGS.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={`tag-chip ${fields.tags.includes(tag.id) ? "active" : ""}`}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="edit-description">Description</label>
            <textarea id="edit-description" rows={3} maxLength={2000} value={fields.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div className="form-group">
            <label htmlFor="edit-note">How do you know? (optional)</label>
            <textarea
              id="edit-note"
              rows={2}
              maxLength={1000}
              placeholder="e.g. I was there last week, or their website says so"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && <p className="modal-error">{error}</p>}
          <button type="submit" className="btn-submit" disabled={changedCount === 0 || websiteInvalid || sending}>
            {sending
              ? "Sending..."
              : changedCount === 0
                ? "Change something to suggest an edit"
                : `Send ${changedCount} change${changedCount === 1 ? "" : "s"} for review`}
          </button>
        </form>
      </div>
    </div>
  );
}
