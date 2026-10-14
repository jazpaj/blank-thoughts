// The inset hairline runs around the card and stops where the bottom-right
// corner is folded back (sizes come from --rule-inset and --fold in CSS).
// Drawn as one continuous path so the intro can "draw" it with a dash offset.

export function initFrame(card) {
  const path = card.querySelector('.card__rule path');

  const draw = () => {
    const css = getComputedStyle(card);
    const i = parseFloat(css.getPropertyValue('--rule-inset')) + 0.5;
    const fold = parseFloat(css.getPropertyValue('--fold'));
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    path.setAttribute('d', `M${w - fold} ${h - i} H${i} V${i} H${w - i} V${h - fold}`);
  };

  new ResizeObserver(draw).observe(card);
  draw();
}
