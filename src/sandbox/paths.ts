import { GuardError } from '../contracts.js';

/** The pinned runtime treats these characters as globs, with no literal-path config API. */
export function hasNativePatternChars(path: string): boolean {
  return /[*?[\]]/.test(path);
}

export function assertLiteralNativePaths(paths: readonly string[]): void {
  if (paths.some(hasNativePatternChars)) throw new GuardError('NATIVE_PATH_UNSUPPORTED', 'Native permission roots containing *, ?, [ or ] are unsupported; no pattern permission was granted');
}
