import { useState, useEffect } from "react";
import { api, Preset, WgetFlags } from "../lib/tauri";
import { Button } from "@yoinkit/ui";

interface PresetManagerProps {
  currentFlags: WgetFlags;
  onLoadPreset: (flags: WgetFlags) => void;
}

export function PresetManager({ currentFlags, onLoadPreset }: PresetManagerProps) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [newName, setNewName] = useState("");
  const [showSave, setShowSave] = useState(false);

  const refresh = async () => {
    try {
      const list = await api.listPresets();
      setPresets(list);
    } catch (err) {
      console.error("Failed to load presets:", err);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const savePreset = async () => {
    if (!newName.trim()) return;
    try {
      await api.savePreset(newName.trim(), JSON.stringify(currentFlags));
      setNewName("");
      setShowSave(false);
      await refresh();
    } catch (err) {
      console.error("Failed to save preset:", err);
    }
  };

  const loadPreset = (preset: Preset) => {
    try {
      const flags = JSON.parse(preset.flags_json) as WgetFlags;
      onLoadPreset(flags);
    } catch (err) {
      console.error("Failed to parse preset flags:", err);
    }
  };

  const deletePreset = async (id: string) => {
    try {
      await api.deletePreset(id);
      await refresh();
    } catch (err) {
      console.error("Failed to delete preset:", err);
    }
  };

  return (
    <div className="bg-yoinkit-surface rounded-lg p-4 border border-yoinkit-muted/10">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-yoinkit-text">Presets</h3>
        <Button variant="ghost" size="sm" onClick={() => setShowSave(!showSave)}>
          {showSave ? "Cancel" : "Save Current"}
        </Button>
      </div>

      {showSave && (
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Preset name..."
            className="flex-1 px-3 py-1.5 bg-yoinkit-bg border border-yoinkit-muted/30 rounded text-sm text-yoinkit-text placeholder-yoinkit-muted/50 focus:outline-none focus:ring-1 focus:ring-yoinkit-primary/50"
            onKeyDown={(e) => e.key === "Enter" && savePreset()}
          />
          <Button size="sm" onClick={savePreset} disabled={!newName.trim()}>
            Save
          </Button>
        </div>
      )}

      {presets.length === 0 ? (
        <p className="text-xs text-yoinkit-muted">No saved presets</p>
      ) : (
        <div className="space-y-1">
          {presets.map((preset) => (
            <div key={preset.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-yoinkit-bg/50 group">
              <button
                onClick={() => loadPreset(preset)}
                className="text-sm text-yoinkit-text hover:text-yoinkit-primary transition-colors text-left flex-1"
              >
                {preset.name}
              </button>
              <button
                onClick={() => deletePreset(preset.id)}
                className="text-xs text-yoinkit-muted hover:text-yoinkit-danger opacity-0 group-hover:opacity-100 transition-all"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
