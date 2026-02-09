export { colors } from './colors';
export { default as theme } from './theme';

import { colors as _colors } from './colors';

/**
 * Get a color value by dot-path string.
 *
 * Usage:
 *   getColor('primary.600')    → '#486581'
 *   getColor('status.success') → '#10b981'
 *   getColor('accent')         → '#38b2ac' (returns DEFAULT)
 */
export function getColor(path) {
  const keys = path.split('.');
  let value = _colors;

  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    value = value[key];
  }

  if (typeof value === 'object' && value !== null) {
    return value.DEFAULT;
  }

  return value;
}
