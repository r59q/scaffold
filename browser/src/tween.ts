const durationMs = 200;

export function tweenEnter(element: HTMLElement): void {
  const view = element.ownerDocument.defaultView;
  if (!view) return;

  const { style } = element;
  const inlineOpacity = style.getPropertyValue("opacity");
  const priority = style.getPropertyPriority("opacity");
  const targetOpacity = Number(view.getComputedStyle(element).opacity || "1");
  let startedAt: number | undefined;

  const tick = (timestamp: number): void => {
    startedAt ??= timestamp;
    const progress = (timestamp - startedAt) / durationMs;
    if (progress >= 1) {
      style.setProperty("opacity", inlineOpacity, priority);
      return;
    }

    const eased = 1 - (1 - progress) ** 2;
    style.setProperty("opacity", String(targetOpacity * eased), priority);
    view.requestAnimationFrame(tick);
  };

  style.setProperty("opacity", "0", priority);
  view.requestAnimationFrame(tick);
}
