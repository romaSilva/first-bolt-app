/**
 * Converts a Unix timestamp (seconds) to a Date object.
 */
export function toDate(unixSeconds: number): Date {
  return new Date(unixSeconds * 1000);
}

/**
 * Formats a Unix timestamp (seconds) into a human-readable date/time string.
 */
export function toReadableDate(unixSeconds: number): string {
  return toDate(unixSeconds).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });
}
