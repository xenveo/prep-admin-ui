"use client";

import { useHeaderAction } from "./settings-context";
import type { SettingsDraft } from "./use-settings-draft";

/** Header "Save changes" that mirrors the draft: inert when clean, busy while saving. */
export function useSaveHeader(draft: SettingsDraft, onSave: () => void, enabled = true) {
  useHeaderAction(
    enabled
      ? {
          label: draft.saving ? "Saving…" : "Save changes",
          loading: draft.saving,
          disabledReason: draft.dirty ? undefined : "No changes to save",
          onClick: onSave,
        }
      : null,
  );
}
