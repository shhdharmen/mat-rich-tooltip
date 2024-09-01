/**
 * Throws an exception for the case when rich tooltip's x-position value isn't valid.
 * In other words, it doesn't match 'before' or 'after'.
 * @docs-private
 */
export function throwRichTooltipInvalidPositionX() {
  throw Error(`xPosition value must be either 'before' or after'`);
}

/**
 * Throws an exception for the case when rich tooltip's y-position value isn't valid.
 * In other words, it doesn't match 'above' or 'below'.
 * @docs-private
 */
export function throwRichTooltipInvalidPositionY() {
  throw Error(`yPosition value must be either 'above' or below'`);
}
