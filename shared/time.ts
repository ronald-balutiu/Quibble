// The Workers AI daily allowance resets at the next 00:00 UTC. The Worker reports
// that time when the cloud judge rests, and the browser assumes it when the
// platform's own limit answers instead.
export function nextUtcMidnight(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString()
}
