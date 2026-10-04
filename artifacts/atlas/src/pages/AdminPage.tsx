import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  deleteSpot,
  fetchAllSpots,
  fetchDeletedSpots,
  fetchPendingEdits,
  fetchRecentRatings,
  fetchReports,
  reviewEdit,
  sendSignInLink,
  setRaterStatus,
  setRatingStatus,
  setReportStatus,
  restoreSpot,
  signOut,
  type AdminRating,
  type AdminSpot,
  type DeletedSpot,
  type PendingEdit,
  type ProblemReport,
  type SpotSnapshot,
} from "@/lib/admin-data";
import { FLAG_LABELS, ratingFlags } from "@/lib/rating-flags";
import { requestSummary } from "@/lib/store";
import { formatWeeklyHours, getTagLabel, SCORE_CATEGORY_LABELS, type OperatingHours, type ScoreCategory } from "@/lib/types";

type Tab = "edits" | "reports" | "ratings" | "spots";

const REPORT_REASONS: Record<ProblemReport["reason"], string> = {
  closed: "Closed",
  wrong_info: "Wrong information",
  duplicate: "Duplicate",
  inappropriate: "Inappropriate",
  other: "Other",
};

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  category: "Category",
  city: "City",
  address: "Address",
  lat: "Latitude",
  lng: "Longitude",
  tags: "Tags",
  description: "Description",
  operating_hours: "Hours",
  website: "Website",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatField(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "None";
  if (key === "tags" && Array.isArray(value)) return value.map((t) => getTagLabel(String(t))).join(", ") || "None";
  if (key === "operating_hours") return formatWeeklyHours(value as OperatingHours).join(", ");
  return String(value);
}

function shortId(id: string | null): string {
  return id ? id.slice(0, 8) : "starter data";
}

// ---------- page ----------

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async (s: Session | null) => {
      setSession(s);
      if (!s || s.user.is_anonymous) {
        setIsAdmin(false);
      } else {
        const { data } = await supabase.rpc("is_admin");
        setIsAdmin(data === true);
      }
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => void load(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <a href="/" className="admin-back">&larr; Atlas</a>
          <h1>Admin</h1>
        </div>
        {session && !session.user.is_anonymous && (
          <div className="admin-account">
            <span>{session.user.email}</span>
            <button type="button" className="admin-btn" onClick={() => signOut()}>Sign out</button>
          </div>
        )}
      </header>

      {loading ? (
        <p className="admin-muted">Loading...</p>
      ) : !session || session.user.is_anonymous ? (
        <SignIn />
      ) : !isAdmin ? (
        <div className="admin-panel">
          <p>You're signed in as <strong>{session.user.email}</strong>, but this account isn't an admin.</p>
          <p className="admin-muted">Account ID: <code>{session.user.id}</code></p>
        </div>
      ) : (
        <Dashboard />
      )}
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      await sendSignInLink(email.trim());
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the link.");
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <div className="admin-panel">
        <p>Check <strong>{email}</strong> for a sign-in link. It brings you back here signed in.</p>
      </div>
    );
  }

  return (
    <form className="admin-panel admin-signin" onSubmit={submit}>
      <label htmlFor="admin-email">Email</label>
      <input id="admin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      <button type="submit" className="admin-btn admin-btn-primary" disabled={state === "sending"}>
        {state === "sending" ? "Sending..." : "Email me a sign-in link"}
      </button>
      {state === "error" && <p className="admin-error">{error}</p>}
    </form>
  );
}

// ---------- dashboard ----------

function Dashboard() {
  const [tab, setTab] = useState<Tab>("edits");
  const [edits, setEdits] = useState<PendingEdit[]>([]);
  const [reports, setReports] = useState<ProblemReport[]>([]);
  const [ratings, setRatings] = useState<AdminRating[]>([]);
  const [spots, setSpots] = useState<AdminSpot[]>([]);
  const [deleted, setDeleted] = useState<DeletedSpot[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [e, r, ra, s, d] = await Promise.all([
        fetchPendingEdits(),
        fetchReports(),
        fetchRecentRatings(),
        fetchAllSpots(),
        fetchDeletedSpots(),
      ]);
      setEdits(e);
      setReports(r);
      setRatings(ra);
      setSpots(s);
      setDeleted(d);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the queues.");
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Run a moderation action, then refresh every queue, since one action can change several
  const act = useCallback(
    async (action: () => Promise<unknown>) => {
      try {
        await action();
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "That didn't work.");
      }
    },
    [reload],
  );

  const flaggedCount = useMemo(
    () => ratings.filter((r) => r.status === "visible" && ratingFlags(r, ratings).length > 0).length,
    [ratings],
  );
  const unlinkedCount = spots.filter((s) => !s.osm_id).length;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "edits", label: "Edits", count: edits.length },
    { id: "reports", label: "Reports", count: reports.length },
    { id: "ratings", label: "Ratings", count: flaggedCount },
    { id: "spots", label: "Spots", count: unlinkedCount },
  ];

  return (
    <>
      <nav className="admin-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`admin-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count > 0 && <span className="admin-count">{t.count}</span>}
          </button>
        ))}
      </nav>

      {error && <p className="admin-error">{error}</p>}

      {tab === "edits" && <EditsTab edits={edits} act={act} />}
      {tab === "reports" && <ReportsTab reports={reports} act={act} />}
      {tab === "ratings" && <RatingsTab ratings={ratings} act={act} />}
      {tab === "spots" && <SpotsTab spots={spots} deleted={deleted} act={act} />}
    </>
  );
}

type Act = (action: () => Promise<unknown>) => Promise<void>;

function EditsTab({ edits, act }: { edits: PendingEdit[]; act: Act }) {
  if (edits.length === 0) return <p className="admin-empty">No edits waiting for review.</p>;

  return (
    <div className="admin-list">
      {edits.map((edit) => (
        <article key={edit.id} className="admin-card">
          <header className="admin-card-header">
            <h2>{edit.spot?.name ?? "Deleted spot"}</h2>
            <span className="admin-muted">{formatDate(edit.created_at)}</span>
          </header>
          {edit.note && <p className="admin-note">"{edit.note}"</p>}
          <table className="admin-diff">
            <thead>
              <tr>
                <th>Field</th>
                <th>Now</th>
                <th>Proposed</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(edit.changes).map(([key, value]) => (
                <tr key={key}>
                  <th scope="row">{FIELD_LABELS[key] ?? key}</th>
                  <td>{formatField(key, edit.spot?.[key as keyof SpotSnapshot])}</td>
                  <td className="admin-diff-new">{formatField(key, value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="admin-actions">
            <button type="button" className="admin-btn admin-btn-primary" onClick={() =>
                act(async () => {
                  await reviewEdit(edit.id, true);
                  // An approved description change clears the old summary; write a fresh one
                  if (edit.changes.description !== undefined) await requestSummary(edit.spot_id);
                })
              }>
              Approve
            </button>
            <button type="button" className="admin-btn" onClick={() => act(() => reviewEdit(edit.id, false))}>
              Reject
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ReportsTab({ reports, act }: { reports: ProblemReport[]; act: Act }) {
  if (reports.length === 0) return <p className="admin-empty">No open problem reports.</p>;

  return (
    <div className="admin-list">
      {reports.map((report) => (
        <article key={report.id} className="admin-card">
          <header className="admin-card-header">
            <h2>{report.spot?.name ?? "Deleted spot"}</h2>
            <span className="admin-chip">{REPORT_REASONS[report.reason]}</span>
            <span className="admin-muted">{formatDate(report.created_at)}</span>
          </header>
          {report.details ? <p className="admin-note">"{report.details}"</p> : <p className="admin-muted">No details given.</p>}
          <div className="admin-actions">
            <button type="button" className="admin-btn admin-btn-primary" onClick={() => act(() => setReportStatus(report.id, "resolved"))}>
              Mark resolved
            </button>
            {report.spot && (
              <button
                type="button"
                className="admin-btn"
                onClick={() => {
                  // The report is deleted with the spot, and the archive keeps a copy of both
                  if (window.confirm(deleteWarning(report.spot!.name))) act(() => deleteSpot(report.spot_id));
                }}
              >
                Delete spot
              </button>
            )}
            <button type="button" className="admin-btn" onClick={() => act(() => setReportStatus(report.id, "dismissed"))}>
              Dismiss
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function RatingsTab({ ratings, act }: { ratings: AdminRating[]; act: Act }) {
  const [flaggedOnly, setFlaggedOnly] = useState(true);
  const withFlags = useMemo(() => ratings.map((r) => ({ rating: r, flags: ratingFlags(r, ratings) })), [ratings]);
  const perRater = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of ratings) if (r.user_id) counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);
    return counts;
  }, [ratings]);
  const shown = withFlags.filter(({ rating, flags }) => !flaggedOnly || flags.length > 0 || rating.status === "hidden");

  return (
    <>
      <label className="admin-toggle">
        <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
        Only flagged and hidden ratings
      </label>
      {shown.length === 0 ? (
        <p className="admin-empty">{flaggedOnly ? "No flagged ratings." : "No ratings yet."}</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Spot</th>
                <th>Scores</th>
                <th>Rater</th>
                <th>Flags</th>
                <th>When</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map(({ rating, flags }) => (
                <tr key={rating.id} className={rating.status === "hidden" ? "admin-row-hidden" : ""}>
                  <td>{rating.spot?.name ?? "Deleted spot"}</td>
                  <td>
                    <div className="admin-scores">
                      {(Object.keys(rating.scores) as ScoreCategory[]).map((k) => (
                        <span key={k} title={SCORE_CATEGORY_LABELS[k]}>
                          {SCORE_CATEGORY_LABELS[k]} {rating.scores[k]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <code>{shortId(rating.user_id)}</code>
                    {rating.user_id && <span className="admin-muted"> ({perRater.get(rating.user_id)} rated)</span>}
                  </td>
                  <td>
                    {flags.map((f) => (
                      <span key={f} className="admin-chip admin-chip-warn">{FLAG_LABELS[f]}</span>
                    ))}
                    {rating.status === "hidden" && <span className="admin-chip">Hidden</span>}
                  </td>
                  <td className="admin-muted">{formatDate(rating.updated_at)}</td>
                  <td>
                    <div className="admin-actions admin-actions-cell">
                    {rating.status === "visible" ? (
                      <button type="button" className="admin-btn" onClick={() => act(() => setRatingStatus(rating.id, "hidden"))}>
                        Hide
                      </button>
                    ) : (
                      <button type="button" className="admin-btn" onClick={() => act(() => setRatingStatus(rating.id, "visible"))}>
                        Restore
                      </button>
                    )}
                    {rating.user_id && rating.status === "visible" && (
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={() => {
                          const n = perRater.get(rating.user_id!) ?? 0;
                          if (window.confirm(`Hide all ${n} rating${n === 1 ? "" : "s"} from rater ${shortId(rating.user_id)}?`)) {
                            act(() => setRaterStatus(rating.user_id!, "hidden"));
                          }
                        }}
                      >
                        Hide all from rater
                      </button>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function deleteWarning(name: string): string {
  return `Delete "${name}"? Its ratings, edits and reports go with it. You can restore all of it from Deleted for 90 days.`;
}

function SpotsTab({ spots, deleted, act }: { spots: AdminSpot[]; deleted: DeletedSpot[]; act: Act }) {
  const [filter, setFilter] = useState<"unlinked" | "all" | "deleted">("unlinked");
  const shown = filter === "unlinked" ? spots.filter((s) => !s.osm_id) : spots;

  return (
    <>
      <div className="admin-filters">
        {(
          [
            ["unlinked", "Not linked to OpenStreetMap"],
            ["all", "All"],
            ["deleted", "Deleted"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={`admin-tab ${filter === id ? "active" : ""}`} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      {filter === "unlinked" && shown.length > 0 && (
        <p className="admin-muted">
          These spots can't be checked against a real place, so their pins, addresses and hours may be approximate.
          "Find on OpenStreetMap" searches for the place to compare.
        </p>
      )}
      {filter === "deleted" ? (
        <DeletedSpots deleted={deleted} act={act} />
      ) : shown.length === 0 ? (
        <p className="admin-empty">Nothing here.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Spot</th>
                <th>Address</th>
                <th>Ratings</th>
                <th>OpenStreetMap</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((spot) => (
                <tr key={spot.id}>
                  <td>
                    {spot.name}
                    <div className="admin-muted">{spot.category}, {spot.city}</div>
                  </td>
                  <td>{spot.address}</td>
                  <td>{spot.rating_count}</td>
                  <td>
                    {spot.osm_id ? (
                      <a href={`https://www.openstreetmap.org/${spot.osm_type}/${spot.osm_id}`} target="_blank" rel="noreferrer">
                        Linked
                      </a>
                    ) : (
                      <a
                        href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(`${spot.name}, ${spot.city}`)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Find on OpenStreetMap
                      </a>
                    )}
                  </td>
                  <td>
                    <div className="admin-actions admin-actions-cell">
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => {
                        if (window.confirm(deleteWarning(spot.name))) act(() => deleteSpot(spot.id));
                      }}
                    >
                      Delete
                    </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function DeletedSpots({ deleted, act }: { deleted: DeletedSpot[]; act: Act }) {
  if (deleted.length === 0) return <p className="admin-empty">Nothing deleted in the last 90 days.</p>;

  return (
    <>
      <p className="admin-muted">
        Deleted spots are kept for 90 days with their ratings, edits and reports. Restoring puts all of it back.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Spot</th>
              <th>Ratings</th>
              <th>Deleted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {deleted.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.name}
                  <div className="admin-muted">{d.city}</div>
                </td>
                <td>{d.rating_count}</td>
                <td>{formatDate(d.deleted_at)}</td>
                <td>
                  <div className="admin-actions admin-actions-cell">
                    <button type="button" className="admin-btn" onClick={() => act(() => restoreSpot(d.id))}>
                      Restore
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
