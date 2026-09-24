/**
 * Separator for "A · B" labels. Overpass's middle dot swallows the following
 * space, so it's followed by an en space (U+2002) to render balanced.
 */
export const SEP = " · ";

/** "Exit 03" */
export const exitLabel = (n: number) => `Exit ${String(n).padStart(2, "0")}`;
