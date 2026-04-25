/**
 * Dev-only logging utility.
 * All calls are no-ops in production builds, keeping console clean.
 */

const isDev = process.env.NODE_ENV !== 'production';

export function devLog(...args: unknown[]): void {
  if (isDev) {
    console.log(...args);
  }
}

export function devWarn(...args: unknown[]): void {
  if (isDev) {
    console.warn(...args);
  }
}
