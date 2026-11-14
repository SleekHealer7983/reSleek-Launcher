import { reactive } from "vue";
import type { DroppedDeviceFile } from "../types";

export type DropZone = "desktop-files" | "recycle-bin" | null;

export interface PointerDragPayload {
  kind: "file" | "app";
  label: string;
  file?: DroppedDeviceFile;
  appId?: string;
  icon?: string | null;
  symbol?: string;
}

export interface PointerDragResult {
  zone: DropZone;
  appId: string | null;
}

export const pointerDrag = reactive({
  active: false,
  payload: null as PointerDragPayload | null,
  zone: null as DropZone,
  targetAppId: null as string | null,
});

const THRESHOLD = 6;

let startX = 0;
let startY = 0;
let pointerId = -1;
let started = false;
let ghost: HTMLElement | null = null;
let dropCallback:
  | ((payload: PointerDragPayload, result: PointerDragResult) => void)
  | null = null;
let moveHandler: ((event: PointerEvent) => void) | null = null;
let upHandler: ((event: PointerEvent) => void) | null = null;

function createGhost(payload: PointerDragPayload) {
  const element = document.createElement("div");
  element.className = "pointer-drag-ghost";

  const icon = document.createElement("span");
  icon.className = "pointer-drag-ghost-icon";

  if (payload.icon) {
    const image = document.createElement("img");
    image.src = payload.icon;
    image.alt = "";
    icon.appendChild(image);
  } else if (payload.symbol) {
    icon.classList.add("material-symbols-rounded");
    icon.textContent = payload.symbol;
  } else {
    icon.textContent = payload.label.trim().charAt(0).toUpperCase() || "?";
  }

  const label = document.createElement("span");
  label.className = "pointer-drag-ghost-label";
  label.textContent = payload.label;

  element.append(icon, label);
  document.body.appendChild(element);
  return element;
}

function positionGhost(x: number, y: number) {
  if (!ghost) return;
  ghost.style.transform = `translate3d(${x + 14}px, ${y + 12}px, 0)`;
}

function targetAt(x: number, y: number): PointerDragResult {
  const element = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!element) return { zone: null, appId: null };

  const target = element.closest<HTMLElement>("[data-drop-target]");
  const appCell = element.closest<HTMLElement>("[data-app-cell]");
  const rawZone = target?.dataset.dropTarget;
  const zone: DropZone =
    rawZone === "desktop-files" || rawZone === "recycle-bin"
      ? rawZone
      : null;

  return {
    zone,
    appId: appCell?.dataset.appId ?? null,
  };
}

function suppressNextClick() {
  const suppress = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    window.removeEventListener("click", suppress, true);
  };
  window.addEventListener("click", suppress, true);
  window.setTimeout(() => {
    window.removeEventListener("click", suppress, true);
  }, 0);
}

function cleanup() {
  if (moveHandler) window.removeEventListener("pointermove", moveHandler);
  if (upHandler) {
    window.removeEventListener("pointerup", upHandler);
    window.removeEventListener("pointercancel", upHandler);
  }

  ghost?.remove();
  ghost = null;
  moveHandler = null;
  upHandler = null;
  dropCallback = null;
  started = false;
  pointerId = -1;

  document.body.classList.remove(
    "is-pointer-dragging",
    "is-file-dragging",
    "is-app-dragging",
  );
  pointerDrag.active = false;
  pointerDrag.payload = null;
  pointerDrag.zone = null;
  pointerDrag.targetAppId = null;
}

export function beginPointerDrag(
  event: PointerEvent,
  payload: PointerDragPayload,
  onDrop: (payload: PointerDragPayload, result: PointerDragResult) => void,
) {
  if (event.button !== 0) return;
  cleanup();

  startX = event.clientX;
  startY = event.clientY;
  pointerId = event.pointerId;
  dropCallback = onDrop;

  moveHandler = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) return;

    if (!started) {
      const distance = Math.hypot(
        moveEvent.clientX - startX,
        moveEvent.clientY - startY,
      );
      if (distance < THRESHOLD) return;

      started = true;
      pointerDrag.active = true;
      pointerDrag.payload = payload;
      document.body.classList.add("is-pointer-dragging");
      document.body.classList.add(
        payload.kind === "file" ? "is-file-dragging" : "is-app-dragging",
      );
      ghost = createGhost(payload);
    }

    moveEvent.preventDefault();
    positionGhost(moveEvent.clientX, moveEvent.clientY);

    const result = targetAt(moveEvent.clientX, moveEvent.clientY);
    pointerDrag.zone = result.zone;
    pointerDrag.targetAppId = result.appId;
  };

  upHandler = (upEvent: PointerEvent) => {
    if (upEvent.pointerId !== pointerId) return;

    if (!started) {
      cleanup();
      return;
    }

    const result = targetAt(upEvent.clientX, upEvent.clientY);
    const callback = dropCallback;
    suppressNextClick();
    cleanup();
    callback?.(payload, result);
  };

  window.addEventListener("pointermove", moveHandler, { passive: false });
  window.addEventListener("pointerup", upHandler);
  window.addEventListener("pointercancel", upHandler);
}
