import { useState } from "react";
import { WgetFlags } from "../lib/tauri";

interface CommandBuilderProps {
  flags: WgetFlags;
  onChange: (flags: WgetFlags) => void;
}

interface FlagGroup {
  label: string;
  fields: FlagField[];
}

interface FlagField {
  key: keyof WgetFlags;
  label: string;
  type: "boolean" | "string" | "number";
  placeholder?: string;
  tooltip?: string;
}

const FLAG_GROUPS: FlagGroup[] = [
  {
    label: "Recursion",
    fields: [
      { key: "recursive", label: "Recursive download", type: "boolean", tooltip: "--recursive" },
      { key: "depth", label: "Depth limit", type: "number", placeholder: "e.g. 5" },
      { key: "convert_links", label: "Convert links for offline viewing", type: "boolean", tooltip: "--convert-links" },
      { key: "page_requisites", label: "Download page requisites (CSS, images)", type: "boolean", tooltip: "--page-requisites" },
      { key: "no_parent", label: "Don't ascend to parent directory", type: "boolean", tooltip: "--no-parent" },
      { key: "mirror", label: "Mirror entire site", type: "boolean", tooltip: "--mirror" },
    ],
  },
  {
    label: "Filtering",
    fields: [
      { key: "accept", label: "Accept file types", type: "string", placeholder: "*.pdf,*.doc" },
      { key: "reject", label: "Reject file types", type: "string", placeholder: "*.gif,*.jpg" },
    ],
  },
  {
    label: "Rate & Limits",
    fields: [
      { key: "limit_rate", label: "Rate limit", type: "string", placeholder: "200k, 1m" },
      { key: "wait", label: "Wait between requests (sec)", type: "number", placeholder: "1" },
      { key: "random_wait", label: "Randomize wait time", type: "boolean" },
      { key: "timeout", label: "Timeout (sec)", type: "number", placeholder: "30" },
      { key: "tries", label: "Number of retries", type: "number", placeholder: "3" },
    ],
  },
  {
    label: "Authentication",
    fields: [
      { key: "user", label: "Username", type: "string", placeholder: "username" },
      { key: "password", label: "Password", type: "string", placeholder: "password" },
      { key: "user_agent", label: "User agent", type: "string", placeholder: "Mozilla/5.0..." },
    ],
  },
  {
    label: "Output",
    fields: [
      { key: "output_document", label: "Output filename", type: "string", placeholder: "output.html" },
      { key: "continue_download", label: "Resume interrupted download", type: "boolean", tooltip: "--continue" },
      { key: "timestamping", label: "Only download newer files", type: "boolean", tooltip: "--timestamping" },
      { key: "no_check_certificate", label: "Skip SSL certificate check", type: "boolean" },
    ],
  },
];

export function CommandBuilder({ flags, onChange }: CommandBuilderProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["Recursion"]));

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const updateFlag = (key: keyof WgetFlags, value: unknown) => {
    onChange({ ...flags, [key]: value || undefined });
  };

  return (
    <div className="space-y-2">
      {FLAG_GROUPS.map((group) => (
        <div key={group.label} className="border border-yoinkit-muted/20 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleGroup(group.label)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-yoinkit-surface hover:bg-yoinkit-surface/80 transition-colors text-left"
          >
            <span className="text-sm font-medium text-yoinkit-text">{group.label}</span>
            <span className="text-yoinkit-muted text-xs">
              {expandedGroups.has(group.label) ? "▲" : "▼"}
            </span>
          </button>
          {expandedGroups.has(group.label) && (
            <div className="px-4 py-3 space-y-3 bg-yoinkit-bg/50">
              {group.fields.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  {field.type === "boolean" ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(flags[field.key])}
                        onChange={(e) => updateFlag(field.key, e.target.checked ? true : undefined)}
                        className="w-4 h-4 rounded border-yoinkit-muted/30 bg-yoinkit-bg text-yoinkit-primary focus:ring-yoinkit-primary/50"
                      />
                      <span className="text-sm text-yoinkit-text">{field.label}</span>
                      {field.tooltip && (
                        <span className="text-xs text-yoinkit-muted font-mono">{field.tooltip}</span>
                      )}
                    </label>
                  ) : (
                    <div className="flex-1">
                      <label className="text-sm text-yoinkit-text block mb-1">{field.label}</label>
                      <input
                        type={field.type === "number" ? "number" : "text"}
                        value={(flags[field.key] as string | number) ?? ""}
                        onChange={(e) => {
                          const val = field.type === "number"
                            ? (e.target.value ? Number(e.target.value) : undefined)
                            : (e.target.value || undefined);
                          updateFlag(field.key, val);
                        }}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-1.5 bg-yoinkit-bg border border-yoinkit-muted/30 rounded text-sm text-yoinkit-text placeholder-yoinkit-muted/50 focus:outline-none focus:ring-1 focus:ring-yoinkit-primary/50"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
