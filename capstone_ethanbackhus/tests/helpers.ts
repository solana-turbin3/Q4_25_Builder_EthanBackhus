// helpers.ts

/**
 * Converts a duration in seconds into HH:MM:SS format
 */
export const formatDuration = (seconds: number): string =>
  [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map(n => n.toString().padStart(2, '0'))
    .join(':');
