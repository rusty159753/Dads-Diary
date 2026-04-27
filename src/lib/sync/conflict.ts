/**
 * Conflict resolution: determine whether local or remote version should win.
 * Strategy: last-write-wins based on updated_at timestamp.
 */

interface Versioned {
  updated_at: string;
}

export function shouldPushLocal(
  local: Versioned,
  remote: Versioned
): boolean {
  const localTime = Date.parse(local.updated_at);
  const remoteTime = Date.parse(remote.updated_at);

  // If either timestamp is invalid, default to pushing local (safer).
  if (Number.isNaN(localTime) || Number.isNaN(remoteTime)) {
    return true;
  }

  // Local wins if it's newer or equal.
  return localTime >= remoteTime;
}
