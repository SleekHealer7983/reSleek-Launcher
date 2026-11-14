import { computed, onBeforeUnmount, ref, type Ref } from "vue";

const VIEWPORT_MARGIN = 16;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Free dragging for a card. Bind `start`, `move` and `end` to a handle
 * (e.g. the card header) and apply `style` to the card root.
 *
 * `translate` is used instead of `transform`, so the component's own
 * enter/leave animations keep working while the card is being moved.
 */
export function useCardDrag(cardRef: Ref<HTMLElement | null>) {
  const x = ref(0);
  const y = ref(0);
  const dragging = ref(false);

  let pointerId = -1;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;

  const style = computed(() => ({
    translate: `${x.value}px ${y.value}px`,
  }));

  function start(event: PointerEvent) {
    if (event.button !== 0) return;

    const interactive = event
      .composedPath()
      .some(
        (node) =>
          node instanceof HTMLElement &&
          node.matches(
            "button, a, input, label, select, textarea, m-switch, .mtrl-switch, [role='switch'], [data-no-drag]",
          ),
      );
    if (interactive) return;

    const card = cardRef.value;
    const handle = event.currentTarget as HTMLElement | null;
    if (!card || !handle) return;

    const rect = card.getBoundingClientRect();

    startX = event.clientX;
    startY = event.clientY;
    originX = x.value;
    originY = y.value;

    minX = originX + (VIEWPORT_MARGIN - rect.left);
    maxX = originX + (window.innerWidth - VIEWPORT_MARGIN - rect.right);
    minY = originY + (VIEWPORT_MARGIN - rect.top);
    maxY = originY + (window.innerHeight - VIEWPORT_MARGIN - rect.bottom);

    dragging.value = true;
    pointerId = event.pointerId;
    handle.setPointerCapture(pointerId);
    event.preventDefault();
  }

  function move(event: PointerEvent) {
    if (!dragging.value || event.pointerId !== pointerId) return;

    x.value = clamp(originX + event.clientX - startX, minX, maxX);
    y.value = clamp(originY + event.clientY - startY, minY, maxY);
  }

  function end(event: PointerEvent) {
    if (!dragging.value) return;

    const handle = event.currentTarget as HTMLElement | null;
    if (handle?.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }

    dragging.value = false;
    pointerId = -1;
  }

  function reset() {
    x.value = 0;
    y.value = 0;
  }

  onBeforeUnmount(() => {
    dragging.value = false;
  });

  return { style, dragging, start, move, end, reset };
}
