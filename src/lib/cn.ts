export type ClassValue = string | number | false | null | undefined | ClassValue[];

/** Join class names, skipping falsy values. */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const v of values) {
    if (Array.isArray(v)) {
      const nested = cn(...v);
      if (nested) out.push(nested);
    } else if (v || v === 0) {
      out.push(String(v));
    }
  }
  return out.join(" ");
}
