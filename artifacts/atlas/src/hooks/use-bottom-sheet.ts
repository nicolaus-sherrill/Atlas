// The phone's bottom sheet, by hand. No library: one pointer gesture and three resting heights.
//
// How it works:
//   - The sheet rests at one of three detents: peek (a sliver, the map nearly whole), half, or full.
//     CSS draws each one from the shell's data-detent attribute, so at rest React only names a detent.
//   - Dragging the grab zone (the handle and the header under it) writes the live height to a CSS
//     variable on the shell, --sheet-drag, and adds .is-dragging, which turns the transitions off.
//     Nothing re-renders while a finger moves.
//   - On release the sheet settles on the detent nearest to where it was heading: the height plus
//     a little of the finger's speed, so a flick carries it on.
//   - A tap without a drag steps to the next detent. Arrow keys on the handle do the same, so the
//     sheet works without a pointer.
//
// To tune it: the detent heights live in atlas-patterns.css (--sheet-peek, --sheet-half). FLICK_MS
// and TAP_SLOP below are the only numbers the gesture itself uses.

import { useCallback, useRef } from "react";
import type React from "react";

export type Detent = "peek" | "half" | "full";

// How far ahead a flick is projected: release speed (px/ms) times this, added to the height
const FLICK_MS = 160;
// Movement under this many px counts as a tap, not a drag
const TAP_SLOP = 6;

// The order a tap steps through
const NEXT: Record<Detent, Detent> = { peek: "half", half: "full", full: "half" };

interface Options {
  // The element that carries data-detent and the --sheet-drag variable
  shellRef: React.RefObject<HTMLElement | null>;
  // The sheet itself, measured to know each detent's height
  sheetRef: React.RefObject<HTMLElement | null>;
  detent: Detent;
  onDetentChange: (detent: Detent) => void;
}

// Each detent's height in px, read from the CSS the sheet actually uses at rest
export function detentHeights(shell: HTMLElement): Record<Detent, number> {
  const styles = getComputedStyle(shell);
  const full = shell.clientHeight;
  const px = (name: string) => {
    const v = styles.getPropertyValue(name).trim();
    return v.endsWith("%") ? (parseFloat(v) / 100) * full : parseFloat(v);
  };
  return { peek: px("--sheet-peek"), half: px("--sheet-half"), full };
}

export function useBottomSheet({ shellRef, sheetRef, detent, onDetentChange }: Options) {
  // Where the drag started, and the last two samples, for the release speed
  const drag = useRef<{ startY: number; startHeight: number; lastY: number; lastT: number; speed: number; moved: boolean } | null>(null);

  const setLiveHeight = (height: number | null) => {
    const shell = shellRef.current;
    if (!shell) return;
    if (height === null) {
      shell.classList.remove("is-dragging");
      shell.style.removeProperty("--sheet-drag");
    } else {
      shell.classList.add("is-dragging");
      shell.style.setProperty("--sheet-drag", `${height}px`);
    }
  };

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only the primary button or a touch; a control inside the grab zone keeps its own click
    if (e.button !== 0 || (e.target as HTMLElement).closest("button:not(.sheet-handle), a, input")) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startHeight: sheet.getBoundingClientRect().height, lastY: e.clientY, lastT: e.timeStamp, speed: 0, moved: false };
  }, [sheetRef]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    const shell = shellRef.current;
    if (!d || !shell) return;
    const dy = d.startY - e.clientY; // up is positive: the sheet grows
    if (!d.moved && Math.abs(dy) < TAP_SLOP) return;
    d.moved = true;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.speed = (d.lastY - e.clientY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    const { peek, full } = detentHeights(shell);
    // Held between peek and full, so the sheet never leaves the screen or overshoots the top
    setLiveHeight(Math.min(full, Math.max(peek, d.startHeight + dy)));
  }, [shellRef]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    const shell = shellRef.current;
    drag.current = null;
    if (!d || !shell) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d.moved) {
      setLiveHeight(null);
      onDetentChange(NEXT[detent]);
      return;
    }
    // Settle on the detent nearest the projected height. The transition runs from the live height,
    // because --sheet-drag is cleared in the same frame the new detent is set.
    const heights = detentHeights(shell);
    const projected = d.startHeight + (d.startY - e.clientY) + d.speed * FLICK_MS;
    const nearest = (Object.keys(heights) as Detent[]).reduce((a, b) =>
      Math.abs(heights[b] - projected) < Math.abs(heights[a] - projected) ? b : a,
    );
    setLiveHeight(null);
    onDetentChange(nearest);
  }, [shellRef, detent, onDetentChange]);

  // The handle by keyboard: Enter or Space steps like a tap, up grows the sheet, down shrinks it.
  // The handle has no click handler, so a tap isn't counted twice.
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const order: Detent[] = ["peek", "half", "full"];
    const i = order.indexOf(detent);
    if (e.key === "Enter" || e.key === " ") onDetentChange(NEXT[detent]);
    else if (e.key === "ArrowUp" && i < 2) onDetentChange(order[i + 1]);
    else if (e.key === "ArrowDown" && i > 0) onDetentChange(order[i - 1]);
    else return;
    e.preventDefault();
  }, [detent, onDetentChange]);

  // Spread on the grab zone, which holds the handle
  const grabProps = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
  return { grabProps, onHandleKeyDown: onKeyDown };
}
