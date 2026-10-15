"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useAsync } from "@/lib/use-async";
import type { WorkspaceSettings } from "@/lib/types";
import { getWorkspaceSettings, saveWorkspaceSettings } from "@/services/settings";

/** Loads workspace settings, tracks unsaved edits, and saves only the changed fields. */
export function useSettingsDraft() {
  const toast = useToast();
  const { data, error: loadError, loading, reload } = useAsync(getWorkspaceSettings, []);
  const [savedOverride, setSavedOverride] = useState<WorkspaceSettings | null>(null);
  const [edits, setEdits] = useState<Partial<WorkspaceSettings>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saved = savedOverride ?? data;
  const values = saved ? { ...saved, ...edits } : undefined;
  const patch: Partial<WorkspaceSettings> = {};
  if (saved) {
    for (const k of Object.keys(edits) as (keyof WorkspaceSettings)[]) {
      if (edits[k] !== saved[k]) (patch as Record<string, unknown>)[k] = edits[k];
    }
  }
  const dirty = Object.keys(patch).length > 0;

  function set<K extends keyof WorkspaceSettings>(key: K, value: WorkspaceSettings[K]) {
    setSaveError(null);
    setEdits((e) => ({ ...e, [key]: value }));
  }

  async function save(): Promise<boolean> {
    if (!dirty || saving) return false;
    setSaving(true);
    setSaveError(null);
    try {
      const next = await saveWorkspaceSettings(patch);
      setSavedOverride(next);
      setEdits((current) => Object.fromEntries(Object.entries(current).filter(([key, value]) => value !== patch[key as keyof WorkspaceSettings])));
      toast.show({ title: "Settings saved" });
      return true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save. Try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { saved, values, dirty, patch, set, save, saving, saveError, loading: loading && !saved, loadError, reload };
}

export type SettingsDraft = ReturnType<typeof useSettingsDraft>;
