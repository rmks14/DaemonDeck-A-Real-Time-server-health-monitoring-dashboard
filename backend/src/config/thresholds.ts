export const thresholds = {
  cpu: { warning: 80, critical: 90 },
  memory: { warning: 85, critical: 95 },
  disk: { warning: 80, critical: 90 },
} as const;
