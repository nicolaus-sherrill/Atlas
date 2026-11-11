// The pickers the add-a-spot flow and the suggest-an-edit form share: the category, what it
// is good for, whether entry is paid, and tags.
import { CATEGORIES, GOOD_FOR, getTagsByGroup, type Category, type GoodFor, type TagId } from "@/lib/types";
import Icon from "./Icon";

// The line contributors read before adding a place
export const INCLUSION_TEST = "Atlas lists places anyone can walk into, with no membership or invitation, where staying an hour or more is normal.";

export function CategoryPicker({ value, onChange }: { value: Category | null; onChange: (category: Category) => void }) {
  return (
    <div className="category-select">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          type="button"
          className={`category-option ${value === cat.value ? "active" : ""}`}
          aria-pressed={value === cat.value}
          onClick={() => onChange(cat.value)}
        >
          <Icon name={cat.icon} weight="bold" size={16} />
          <span>{cat.label}</span>
        </button>
      ))}
    </div>
  );
}

export function GoodForPicker({ value, onChange }: { value: GoodFor[]; onChange: (goodFor: GoodFor[]) => void }) {
  const toggle = (g: GoodFor) => {
    const next = value.includes(g) ? value.filter((x) => x !== g) : [...value, g];
    // Kept in the fixed order, so the same choices always read the same way
    onChange(GOOD_FOR.map((x) => x.value).filter((x) => next.includes(x)));
  };
  return (
    <div className="good-for-picker">
      {GOOD_FOR.map((g) => (
        <button
          key={g.value}
          type="button"
          className={`category-option good-for-option ${value.includes(g.value) ? "active" : ""}`}
          aria-pressed={value.includes(g.value)}
          onClick={() => toggle(g.value)}
        >
          <span className="good-for-name">{g.label}</span>
          <span className="good-for-hint">{g.hint}</span>
        </button>
      ))}
    </div>
  );
}

export function PaidEntryPicker({ value, onChange }: { value: boolean; onChange: (paid: boolean) => void }) {
  return (
    <div className="category-select">
      <button type="button" className={`category-option ${!value ? "active" : ""}`} aria-pressed={!value} onClick={() => onChange(false)}>
        Free to enter
      </button>
      <button type="button" className={`category-option ${value ? "active" : ""}`} aria-pressed={value} onClick={() => onChange(true)}>
        <Icon name="ticket" weight="bold" size={16} />
        <span>Paid entry</span>
      </button>
    </div>
  );
}

export function TagPicker({ value, onToggle }: { value: TagId[]; onToggle: (tag: TagId) => void }) {
  return (
    <div className="tag-picker">
      {getTagsByGroup().map(({ group, tags }) => (
        <div key={group.key} role="group" aria-label={group.label}>
          <span className="filter-label">{group.label}</span>
          <div className="tag-chip-grid">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={`tag-chip ${value.includes(tag.id) ? "active" : ""}`}
                aria-pressed={value.includes(tag.id)}
                onClick={() => onToggle(tag.id)}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
