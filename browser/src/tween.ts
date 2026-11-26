export interface TweenOptions {
  from: number;
  to: number;
  durationMs: number;
  easing?: (progress: number) => number;
  update: (value: number) => void;
  onComplete?: () => void;
}

export function tween(
  view: Pick<Window, "requestAnimationFrame" | "cancelAnimationFrame">,
  { from, to, durationMs, easing = (progress) => progress, update, onComplete }: TweenOptions,
): () => void {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new RangeError("Tween duration must be finite and non-negative");
  }
  if (durationMs === 0) {
    update(to);
    onComplete?.();
    return () => {};
  }

  let startedAt: number | undefined;
  let active = true;

  function tick(timestamp: number): void {
    startedAt ??= timestamp;
    const progress = (timestamp - startedAt) / durationMs;
    if (progress >= 1) {
      active = false;
      update(to);
      onComplete?.();
      return;
    }

    update(from + (to - from) * easing(progress));
    if (active) frame = view.requestAnimationFrame(tick);
  }

  update(from);
  let frame = view.requestAnimationFrame(tick);
  return () => {
    if (active) {
      active = false;
      view.cancelAnimationFrame(frame);
    }
  };
}

export function tweenEnter(element: HTMLElement): void {
  const view = element.ownerDocument.defaultView;
  if (!view || view.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const { style } = element;
  const inlineOpacity = style.getPropertyValue("opacity");
  const priority = style.getPropertyPriority("opacity");
  const targetOpacity = Number(view.getComputedStyle(element).opacity || "1");

  tween(view, {
    from: 0,
    to: targetOpacity,
    durationMs: 200,
    easing: (progress) => 1 - (1 - progress) ** 2,
    update: (opacity) => style.setProperty("opacity", String(opacity), priority),
    onComplete: () => style.setProperty("opacity", inlineOpacity, priority),
  });
}
