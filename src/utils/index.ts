// ── Numeric Helpers ─────────────────────────────────────────────────────────

/** Safely coerce any value to a number (null/undefined → 0). */
export function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return Number(v);
}

// ── Case Conversion Utilities ────────────────────────────────────────────────

/** Convert a camelCase string to snake_case */
export function camelToSnake(str: string): string {
  return str.replaceAll(/([A-Z])/g, "_$1").toLowerCase();
}

/** Recursively convert all object keys from camelCase to snake_case */
export function toSnakeCase(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (obj && typeof obj === "object" && !(obj instanceof Date)) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[camelToSnake(key)] = toSnakeCase(value);
    }
    return result;
  }
  return obj;
}

/** Convert a snake_case string to camelCase */
export function snakeToCamel(str: string): string {
  return str.replaceAll(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
}

/** Recursively convert all object keys from snake_case to camelCase */
export function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj && typeof obj === "object" && !(obj instanceof Date)) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[snakeToCamel(key)] = toCamelCase(value);
    }
    return result;
  }
  return obj;
}

/** Convert a Mongoose job doc to a snake_case JSON with `id` field */
export function jobToJSON(job: any): any {
  return toSnakeCase({ ...job, id: job._id || job.id });
}

/** Convert a Mongoose profile doc to a snake_case JSON with `id` field */
export function profileToJSON(p: any): any {
  return toSnakeCase({ ...p, id: p._id || p.id });
}

// ── Pagination ──────────────────────────────────────────────────────────────

/** Parse page/limit from query string with safe bounds */
export function parsePagination(query: any): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, Number.parseInt(query.page as string, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(query.limit as string, 10) || 25),
  );
  return { page, limit, skip: (page - 1) * limit };
}
