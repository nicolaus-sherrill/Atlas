import { useState, useRef, useEffect, useCallback } from "react";
import { searchAddress, searchPlaces, type GeocodingResult } from "@/lib/geocode";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: GeocodingResult) => void;
  placeholder?: string;
  id?: string;
  // "place" suggests named businesses, libraries and parks; "address" suggests street addresses
  mode?: "address" | "place";
  autoFocus?: boolean;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "123 Main St",
  id,
  mode = "address",
  autoFocus,
}: AddressAutocompleteProps) {
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      onChange(val);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();

      if (!val.trim() || val.trim().length < 3) {
        setResults([]);
        setLoading(false);
        setOpen(false);
        return;
      }

      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          const search = mode === "place" ? searchPlaces : searchAddress;
          const data = await search(val.trim(), controller.signal);
          if (!controller.signal.aborted) {
            setResults(data);
            setOpen(data.length > 0);
            setLoading(false);
          }
        } catch {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      }, 350);
    },
    [onChange, mode],
  );

  const handleSelect = useCallback(
    (result: GeocodingResult) => {
      onSelect(result);
      setResults([]);
      setOpen(false);
    },
    [onSelect],
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return (
    <div className="address-autocomplete" ref={containerRef}>
      <input
        id={id}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        autoComplete="off"
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {loading && <div className="geocode-loading">Searching...</div>}

      {open && results.length > 0 && (
        <div className="geocode-dropdown" role="listbox">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              className="geocode-result"
              role="option"
              onClick={() => handleSelect(r)}
            >
              {r.name ? (
                <>
                  <span className="geocode-result-name">{r.name}</span>
                  <span className="geocode-result-address">{r.address}</span>
                </>
              ) : (
                r.displayName
              )}
            </button>
          ))}
          {mode === "place" && (
            <div className="geocode-credit">Search by Photon, data © OpenStreetMap contributors</div>
          )}
        </div>
      )}
    </div>
  );
}
