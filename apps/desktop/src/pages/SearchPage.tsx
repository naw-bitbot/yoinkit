import { useState } from "react";
import { Search } from "lucide-react";
import { useSearch } from "../hooks/useSearch";
import { SearchResults } from "../components/SearchResults";

type Filter = "all" | "clip" | "download";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "clip", label: "Clips" },
  { id: "download", label: "Downloads" },
];

export function SearchPage() {
  const { results, loading, query, setQuery } = useSearch();
  const [activeFilter, setActiveFilter] = useState<Filter>("all");

  const filteredResults =
    activeFilter === "all"
      ? results
      : results.filter((r) => r.content_type === activeFilter);

  const showInitialState = !query;
  const showNoResults = !loading && query.length >= 2 && filteredResults.length === 0;
  const showResults = !loading && filteredResults.length > 0;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-[20px] font-bold tracking-tight" style={{ color: "var(--text)" }}>
          Search
        </h2>
        <p className="text-[13px] mt-1" style={{ color: "var(--text-tertiary)" }}>
          Search everything you've ever yoinked
        </p>
      </div>

      {/* Search input */}
      <div
        className="flex items-center gap-2 rounded-[6px] px-3"
        style={{
          background: "var(--fill)",
          border: "0.5px solid var(--border)",
          height: "36px",
        }}
      >
        <Search size={14} strokeWidth={1.5} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type to search…"
          autoFocus
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: "13px",
            color: "var(--text)",
          }}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="text-[11px] shrink-0"
            style={{ color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer" }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-1.5">
        {FILTERS.map(({ id, label }) => {
          const isActive = activeFilter === id;
          return (
            <button
              key={id}
              onClick={() => setActiveFilter(id)}
              className="px-3 py-1 rounded-full text-[11px] transition-all duration-150"
              style={{
                background: isActive
                  ? "color-mix(in srgb, var(--brand) 15%, transparent)"
                  : "var(--fill)",
                color: isActive ? "var(--brand)" : "var(--text-secondary)",
                border: isActive
                  ? "0.5px solid color-mix(in srgb, var(--brand) 40%, transparent)"
                  : "0.5px solid var(--border)",
                fontWeight: isActive ? 500 : 400,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Initial state — no query */}
      {showInitialState && (
        <div
          className="rounded-[10px] py-16 flex flex-col items-center gap-3"
          style={{
            background: "var(--surface-solid)",
            border: "0.5px solid var(--border)",
          }}
        >
          <Search size={32} strokeWidth={1} style={{ color: "var(--text-tertiary)" }} />
          <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            Search everything you've ever yoinked
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            Searching…
          </p>
        </div>
      )}

      {/* No results */}
      {showNoResults && (
        <div
          className="rounded-[10px] py-12 flex flex-col items-center gap-2"
          style={{
            background: "var(--surface-solid)",
            border: "0.5px solid var(--border)",
          }}
        >
          <Search size={32} strokeWidth={1} style={{ color: "var(--text-tertiary)" }} />
          <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            No results found for "{query}"
          </p>
        </div>
      )}

      {/* Results */}
      {showResults && (
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            {filteredResults.length} result{filteredResults.length !== 1 ? "s" : ""}
          </p>
          <SearchResults results={filteredResults} loading={false} />
        </div>
      )}
    </div>
  );
}
