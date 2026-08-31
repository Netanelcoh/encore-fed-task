/**
 * Minimal structured logger. One JSON object per line is what Cloud Run,
 * Render and Fly all parse into searchable fields, so no dependency is needed.
 */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;

export type LogLevel = keyof typeof LEVELS;

let threshold: number = LEVELS.info;

export function setLogLevel(level: LogLevel): void {
  threshold = LEVELS[level];
}

function emit(level: LogLevel, message: string, fields: Record<string, unknown>): void {
  if (LEVELS[level] < threshold) return;

  const line = JSON.stringify({
    severity: level.toUpperCase(),
    time: new Date().toISOString(),
    message,
    ...fields,
  });

  if (level === 'error' || level === 'warn') {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

export const logger = {
  debug: (message: string, fields: Record<string, unknown> = {}) => emit('debug', message, fields),
  info: (message: string, fields: Record<string, unknown> = {}) => emit('info', message, fields),
  warn: (message: string, fields: Record<string, unknown> = {}) => emit('warn', message, fields),
  error: (message: string, fields: Record<string, unknown> = {}) => emit('error', message, fields),
};
