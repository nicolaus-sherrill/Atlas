// The phone's bottom sheet, by hand. No library: one gesture, three resting heights.
//
// How it works:
//   - The sheet is one full-height panel moved with a transform, so a drag never reflows its
//     content. It rests at one of three detents: peek (a sliver, the map nearly whole), half, or
//     full (the panel stops just under the status bar, its handle still showing). CSS draws each
//     one from the shell's data-detent attribute and names each one's offset as --sheet-y-<detent>.
//   - Any drag on the sheet moves it, not only the handle: below full, the content never scrolls,
//     so a finger anywhere on it pulls the sheet up. At full the content scrolls, and the sheet
//     takes the gesture back when the finger pulls down from the top of the scroll.
//   - A drag writes the live offset to --sheet-drag on the shell and adds .is-dragging, which turns
//     the transitions off. Nothing re-renders while a finger moves.
//   - On release the sheet settles on the detent nearest to where it was heading: the offset plus
//     a little of the finger's speed. A quick flick always moves it at least one detent.
//   - A tap on the handle steps to the next detent. Arrow keys on the handle do the same, so the
//     sheet works without a pointer.
//
// Touch goes through native touch listeners, because a finger that starts on scrolling content has
// to be claimed (preventDefault) before the browser starts scrolling it, and React's listeners are
// passive. A mouse can only drag the handle.
//
// To tune it: the detents live in index.css (--sheet-y-*) and atlas-patterns.css (--sheet-peek,
// --sheet-half, --sheet-top-gap). The numbers below are the only ones the gesture itself uses.

import { useCallback, useEffect, useRef } from "react";
import type React from "react";

export type Detent = "peek" | "half" | "full";

// How far ahead a release is projected: release speed (px/ms) times this, added to the offset
const FLICK_MS = 160;
// A release faster than this (px/ms) is a flick, and moves at least one detent
const FLICK_SPEED = 0.5;
// Movement under this many px is a tap, not a drag
const SLOP = 8;
// Past full the sheet gives a little: this share of the pull beyond it
const RUBBER = 0.3;

const ORDER: Detent[] = ["peek", "half", "full"];
// The order a tap steps through
const NEXT: Record<Detent, Detent> = { peek: "half", half: "full", full: "half" };

interface Options {
  // The element that carries data-detent and the --sheet-drag variable
  shellRef: React.RefObject<HTMLElement | null>;
  // The sheet itself
  sheetRef: React.RefObject<HTMLElement | null>;
  detent: Detent;
  onDetentChange: (detent: Detent) => void;
  // Off above the phone's width, where the card is not a sheet
  enabled: boolean;
}

// Each detent's offset from the top of the shell in px, as CSS resolves it. A probe takes the
// value so percentages and the safe-area insets come out in px
export function detentOffsets(shell: HTMLElement): Record<Detent, number> {
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:0;height:0";
  shell.appendChild(probe);
  const read = (d: Detent) => {
    probe.style.top = `var(--sheet-y-${d})`;
    return parseFloat(getComputedStyle(probe).top) || 0;
  };
  const offsets = { peek: read("peek"), half: read("half"), full: read("full") };
  probe.remove();
  return offsets;
}

// How much of the shell each detent leaves the sheet covering, bottom up
export function detentHeights(shell: HTMLElement): Record<Detent, number> {
  const offsets = detentOffsets(shell);
  const h = shell.clientHeight;
  return { peek: h - offsets.peek, half: h - offsets.half, full: h - offsets.full };
}

interface Gesture {
  startX: number;
  startY: number;
  // Where the sheet was, and where it was heading, in offset px
  startOffset: number;
  offset: number;
  from: Detent;
  lastY: number;
  lastT: number;
  speed: number;
  mode: "pending" | "sheet" | "content";
  // Began on the handle, so the drag is the sheet's whatever the content is doing
  onHandle: boolean;
  scroller: HTMLElement | null;
  offsets: Record<Detent, number>;
}

// The nearest ancestor of el, inside the sheet, that scrolls vertically
function scrollerOf(el: Element | null, sheet: HTMLElement): HTMLElement | null {
  for (let node = el; node && node !== sheet; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node as HTMLElement;
  }
  return null;
}

export function useBottomSheet({ shellRef, sheetRef, detent, onDetentChange, enabled }: Options) {
  // The newest detent and callback, for listeners added once
  const latest = useRef({ detent, onDetentChange });
  latest.current = { detent, onDetentChange };

  useEffect(() => {
    const shell = shellRef.current;
    const sheet = sheetRef.current;
    if (!enabled || !shell || !sheet) return;

    let g: Gesture | null = null;

    const setLive = (offset: number | null) => {
      if (offset === null) {
        shell.classList.remove("is-dragging");
        shell.style.removeProperty("--sheet-drag");
      } else {
        shell.classList.add("is-dragging");
        shell.style.setProperty("--sheet-drag", `${offset}px`);
      }
    };

    // The sheet's offset right now, which mid-settle is somewhere between two detents
    const currentOffset = () => new DOMMatrix(getComputedStyle(sheet).transform).m42;

    const begin = (x: number, y: number, t: number, target: Element | null) => {
      g = {
        startX: x, startY: y, lastY: y, lastT: t, speed: 0,
        startOffset: currentOffset(), offset: 0,
        from: latest.current.detent,
        mode: "pending",
        onHandle: !!target?.closest(".sheet-grab"),
        scroller: scrollerOf(target, sheet),
        offsets: detentOffsets(shell),
      };
      g.offset = g.startOffset;
    };

    // Hands the gesture to the sheet from here, so it picks up under the finger without a jump
    const claim = (y: number) => {
      if (!g) return;
      g.mode = "sheet";
      g.startY = y;
      g.startOffset = g.offset;
    };

    // Returns true when the sheet has the gesture, so a touch can stop the page scrolling
    const move = (x: number, y: number, t: number): boolean => {
      if (!g) return false;
      const dy = y - g.startY;
      const down = y > g.lastY;

      if (g.mode === "pending") {
        if (Math.abs(dy) < SLOP && Math.abs(x - g.startX) < SLOP) return false;
        if (Math.abs(x - g.startX) > Math.abs(dy)) {
          // Sideways belongs to the content, a row that scrolls across
          g.mode = "content";
        } else if (g.onHandle || g.from !== "full") {
          // Below full the content never scrolls, so the drag is the sheet's
          claim(y);
        } else if (dy > 0 && (!g.scroller || g.scroller.scrollTop <= 0)) {
          // At full, a pull down from the top of the scroll takes the sheet with it
          claim(y);
        } else {
          g.mode = "content";
        }
      } else if (g.mode === "content") {
        // The content scrolled to its top and the finger is still pulling down: the sheet's turn
        if (down && g.from === "full" && g.scroller && g.scroller.scrollTop <= 0) claim(y);
      }
      if (g.mode !== "sheet") return false;

      const dt = Math.max(1, t - g.lastT);
      g.speed = 0.6 * ((y - g.lastY) / dt) + 0.4 * g.speed;
      g.lastY = y;
      g.lastT = t;

      const { full, peek } = g.offsets;
      let offset = g.startOffset + (y - g.startY);
      if (offset < full) offset = full - (full - offset) * RUBBER;
      g.offset = Math.min(peek, offset);
      setLive(g.offset);
      return true;
    };

    const settle = (cancelled: boolean) => {
      const done = g;
      g = null;
      if (!done) return;
      const { detent: now, onDetentChange: change } = latest.current;
      if (done.mode !== "sheet") {
        // A tap on the handle steps; a tap or a scroll anywhere else is the content's own
        if (done.mode === "pending" && done.onHandle && !cancelled) change(NEXT[now]);
        return;
      }
      const { peek, half, full } = done.offsets;
      const offsets: Record<Detent, number> = { peek, half, full };
      const projected = done.offset + done.speed * FLICK_MS;
      let index = ORDER.indexOf(
        ORDER.reduce((a, b) => (Math.abs(offsets[b] - projected) < Math.abs(offsets[a] - projected) ? b : a)),
      );
      // A flick moves at least one detent the way it went
      const from = ORDER.indexOf(done.from);
      if (done.speed < -FLICK_SPEED) index = Math.max(index, Math.min(2, from + 1));
      else if (done.speed > FLICK_SPEED) index = Math.min(index, Math.max(0, from - 1));
      const next = ORDER[index];
      // The attribute changes in the same frame the live offset is cleared, so the transition runs
      // from where the finger left the sheet and the sheet never snaps back to its old detent first
      shell.dataset.detent = next;
      setLive(null);
      change(next);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        g = null;
        return;
      }
      // A field keeps its own caret and selection
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      const t = e.touches[0];
      begin(t.clientX, t.clientY, e.timeStamp, e.target as Element);
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t && move(t.clientX, t.clientY, e.timeStamp) && e.cancelable) e.preventDefault();
    };
    const onTouchEnd = () => settle(false);
    const onTouchCancel = () => settle(true);

    // A mouse drags the handle only, listening on the document so the pointer can leave it
    const onPointerMove = (e: PointerEvent) => {
      move(e.clientX, e.clientY, e.timeStamp);
    };
    const onPointerEnd = (e: PointerEvent) => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerEnd);
      document.removeEventListener("pointercancel", onPointerEnd);
      settle(e.type === "pointercancel");
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.button !== 0 || !(e.target as HTMLElement).closest(".sheet-grab")) return;
      begin(e.clientX, e.clientY, e.timeStamp, e.target as Element);
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerEnd);
      document.addEventListener("pointercancel", onPointerEnd);
    };

    sheet.addEventListener("touchstart", onTouchStart, { passive: true });
    sheet.addEventListener("touchmove", onTouchMove, { passive: false });
    sheet.addEventListener("touchend", onTouchEnd);
    sheet.addEventListener("touchcancel", onTouchCancel);
    sheet.addEventListener("pointerdown", onPointerDown);
    return () => {
      sheet.removeEventListener("touchstart", onTouchStart);
      sheet.removeEventListener("touchmove", onTouchMove);
      sheet.removeEventListener("touchend", onTouchEnd);
      sheet.removeEventListener("touchcancel", onTouchCancel);
      sheet.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerEnd);
      document.removeEventListener("pointercancel", onPointerEnd);
      setLive(null);
    };
  }, [enabled, shellRef, sheetRef]);

  // The handle by keyboard: Enter or Space steps like a tap, up grows the sheet, down shrinks it.
  // The handle has no click handler, so a tap isn't counted twice.
  const onHandleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const i = ORDER.indexOf(detent);
    if (e.key === "Enter" || e.key === " ") onDetentChange(NEXT[detent]);
    else if (e.key === "ArrowUp" && i < 2) onDetentChange(ORDER[i + 1]);
    else if (e.key === "ArrowDown" && i > 0) onDetentChange(ORDER[i - 1]);
    else return;
    e.preventDefault();
  }, [detent, onDetentChange]);

  return { onHandleKeyDown };
}
