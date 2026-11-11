import { RATED_CRITERIA, isOptionalCriterion, type CategoryScores, type RatedCriterion, type RatedPlace } from "@/lib/types";

interface RatingRowsProps {
  // The kind of place and what it is good for decide which rows may be left blank
  place: RatedPlace;
  scores: CategoryScores;
  onChange: (scores: CategoryScores) => void;
}

// The six rated criteria as rows of five dots. A row starts blank, which is not a low score.
// Rows the place isn't expected to offer are optional: picking the same dot again clears one.
export default function RatingRows({ place, scores, onChange }: RatingRowsProps) {
  const set = (key: RatedCriterion, value: number, optional: boolean) => {
    const next = { ...scores };
    if (optional && next[key] === value) delete next[key];
    else next[key] = value;
    onChange(next);
  };

  const row = (sc: (typeof RATED_CRITERIA)[number]) => {
        const optional = isOptionalCriterion(place, sc.key);
        const value = scores[sc.key];
        return (
          <div key={sc.key} className={`score-category-row${value == null ? " is-blank" : ""}`}>
            <span className="score-category-name">
              {sc.label}
            </span>
            <span className="score-dots-input" role="group" aria-label={`${sc.label}${value == null ? ", not rated" : `, ${value} of 5`}`}>
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`score-dot-char ${value != null && value >= v ? "filled" : ""}`}
                  onClick={() => set(sc.key, v, optional)}
                  aria-label={`${sc.label} ${v} of 5`}
                  aria-pressed={value === v}
                />
              ))}
            </span>
          </div>
        );
  };

  const required = RATED_CRITERIA.filter((sc) => !isOptionalCriterion(place, sc.key));
  const optional = RATED_CRITERIA.filter((sc) => isOptionalCriterion(place, sc.key));

  return (
    <div className="score-categories">
      {required.map(row)}
      {optional.length > 0 && (
        <>
          <span className="filter-label score-optional-head">Optional here</span>
          <p className="modal-hint">Leave blank if it doesn't apply. A blank never lowers the score.</p>
          {optional.map(row)}
        </>
      )}
    </div>
  );
}
