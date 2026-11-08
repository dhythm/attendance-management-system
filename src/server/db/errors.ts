const UNIQUE_VIOLATION = "23505";

function hasCode(value: unknown): value is { code: unknown } {
  return typeof value === "object" && value !== null && "code" in value;
}

export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (hasCode(current) && current.code === UNIQUE_VIOLATION) return true;
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}
