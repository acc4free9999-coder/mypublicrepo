/** Let the chart paint its first fitted range before restoring manual scaling. */
export function initializePriceScale(
  apply: (autoScale: boolean) => void,
  preferredAutoScale: () => boolean,
  schedule = requestAnimationFrame,
  cancel = cancelAnimationFrame,
): () => void {
  apply(true);
  let frame = schedule(() => {
    frame = schedule(() => apply(preferredAutoScale()));
  });
  return () => cancel(frame);
}
