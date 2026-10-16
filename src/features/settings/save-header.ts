"use client";

import type { WorkspaceSettings } from "@/lib/types";
import { useHeaderAction } from "./settings-context";
import type { SettingsDraft } from "./use-settings-draft";

/** Floating "unsaved changes" bar that mirrors the draft: shown while dirty or saving, busy while saving. */
export function useSaveHeader(draft: SettingsDraft, onSave: () => void, enabled = true) {
  useHeaderAction(
    enabled && (draft.dirty || draft.saving)
      ? {
          label: draft.saving ? "Saving…" : "Save changes",
          loading: draft.saving,
          placement: "savebar",
          onClick: onSave,
          onDiscard: () => {
            const saved = draft.saved;
            if (!saved || draft.saving) return;
            for (const k of Object.keys(draft.patch) as (keyof WorkspaceSettings)[]) {
              draft.set(k, saved[k]);
            }
          },
        }
      : null,
  );
}
