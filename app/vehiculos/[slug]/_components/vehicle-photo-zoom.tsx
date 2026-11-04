'use client';

import { useEffect, useImperativeHandle, useRef, useState, type PointerEvent, type ReactNode, type Ref } from 'react';

export type PhotoZoomHandle = {
  /** Zooms into the centre, or back out when already zoomed. */
  toggle: () => void;
  /** Multiplies the zoom around the centre. */
  zoomBy: (factor: number) => void;
};

type View = { scale: number; x: number; y: number };

const RESET: View = { scale: 1, x: 0, y: 0 };
const SWIPE_DISTANCE = 48;
const TAP_SLOP = 6;
const DOUBLE_TAP_MS = 300;

/**
 * The expanded photo, zoomable up to the file's own resolution (at least 2×, at most 4×).
 * Mouse: click zooms in at that point, drag pans, a click while zoomed zooms out, the wheel or a
 * trackpad pinch zooms around the pointer. Touch: pinch zooms, one finger pans while zoomed, a double
 * tap toggles, and a horizontal swipe at normal size moves to the next or previous photo.
 */
export function VehiclePhotoZoom({
  children,
  onSwipe,
  onZoomChange,
  ref,
}: {
  children: ReactNode;
  onSwipe: (direction: 1 | -1) => void;
  onZoomChange: (zoomed: boolean) => void;
  ref?: Ref<PhotoZoomHandle>;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(RESET);
  const [animate, setAnimate] = useState(false);
  const [dragging, setDragging] = useState(false);
  const viewRef = useRef(view);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pan = useRef<{ x: number; y: number; view: View; moved: boolean; type: string } | null>(null);
  const pinch = useRef<{ distance: number; mid: { x: number; y: number }; view: View } | null>(null);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);

  const zoomed = view.scale > 1;

  // The photo's size at 1× (object-fit: contain) and how far it can zoom before going past its pixels.
  const measure = () => {
    const area = areaRef.current;
    const width = area?.clientWidth ?? 0;
    const height = area?.clientHeight ?? 0;
    const image = area?.querySelector('img');
    if (!image?.naturalWidth) return { width, height, photoWidth: width, photoHeight: height, max: 2 };
    const fit = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const photoWidth = image.naturalWidth * fit;
    return {
      width,
      height,
      photoWidth,
      photoHeight: image.naturalHeight * fit,
      max: Math.min(4, Math.max(2, image.naturalWidth / photoWidth)),
    };
  };

  /** Keeps the photo covering the area while zoomed, so panning never shows empty space past an edge. */
  const clamp = ({ scale, x, y }: View): View => {
    const { width, height, photoWidth, photoHeight, max } = measure();
    const nextScale = Math.min(max, Math.max(1, scale));
    if (nextScale <= 1.01) return RESET;
    const limitX = Math.max(0, (photoWidth * nextScale - width) / 2);
    const limitY = Math.max(0, (photoHeight * nextScale - height) / 2);
    return {
      scale: nextScale,
      x: Math.min(limitX, Math.max(-limitX, x)),
      y: Math.min(limitY, Math.max(-limitY, y)),
    };
  };

  const apply = (next: View, animated: boolean) => {
    if (next.scale > 1 !== viewRef.current.scale > 1) onZoomChange(next.scale > 1);
    viewRef.current = next;
    setAnimate(animated);
    setView(next);
  };

  /** A point relative to the area's centre, where the transform's origin sits. */
  const local = (clientX: number, clientY: number) => {
    const rect = areaRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  };

  /** Scales to `scale` keeping the photo point under `point` in place. */
  const zoomAround = (scale: number, point: { x: number; y: number }, from: View, animated: boolean) => {
    const ratio = Math.min(measure().max, Math.max(1, scale)) / from.scale;
    apply(
      clamp({
        scale: from.scale * ratio,
        x: point.x - (point.x - from.x) * ratio,
        y: point.y - (point.y - from.y) * ratio,
      }),
      animated,
    );
  };

  const toggleAt = (point: { x: number; y: number }) => {
    const current = viewRef.current;
    if (current.scale > 1) apply(RESET, true);
    else zoomAround(measure().max, point, current, true);
  };

  useImperativeHandle(ref, () => ({
    toggle: () => toggleAt({ x: 0, y: 0 }),
    zoomBy: factor => zoomAround(viewRef.current.scale * factor, { x: 0, y: 0 }, viewRef.current, true),
  }));

  // React registers wheel listeners as passive, and the wheel has to be cancelled to zoom instead of scroll.
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      // A trackpad pinch arrives as a wheel with ctrlKey and small deltas.
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.002));
      zoomAround(viewRef.current.scale * factor, local(event.clientX, event.clientY), viewRef.current, false);
    };
    area.addEventListener('wheel', onWheel, { passive: false });
    return () => area.removeEventListener('wheel', onWheel);
  });

  // A new window size changes the photo's 1× size, so the zoom starts over.
  useEffect(() => {
    const reset = () => {
      if (viewRef.current.scale > 1) onZoomChange(false);
      viewRef.current = RESET;
      setAnimate(false);
      setView(RESET);
    };
    window.addEventListener('resize', reset);
    return () => window.removeEventListener('resize', reset);
  }, [onZoomChange]);

  const startPinch = () => {
    const [a, b] = [...pointers.current.values()];
    pinch.current = {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      mid: local((a.x + b.x) / 2, (a.y + b.y) / 2),
      view: viewRef.current,
    };
    pan.current = null;
  };

  const startPan = (event: PointerEvent) => {
    pan.current = { x: event.clientX, y: event.clientY, view: viewRef.current, moved: false, type: event.pointerType };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    // Capture keeps a drag that leaves the photo going; a pointer that already ended can't be captured.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) startPinch();
    else if (pointers.current.size === 1) startPan(event);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const start = pinch.current;
      const scale = (start.view.scale * Math.hypot(a.x - b.x, a.y - b.y)) / start.distance;
      const mid = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      const ratio = Math.min(measure().max, Math.max(1, scale)) / start.view.scale;
      // The pinched photo point follows the fingers' midpoint, so pinching also pans.
      apply(
        clamp({
          scale: start.view.scale * ratio,
          x: mid.x - (start.mid.x - start.view.x) * ratio,
          y: mid.y - (start.mid.y - start.view.y) * ratio,
        }),
        false,
      );
      return;
    }
    const current = pan.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (Math.hypot(dx, dy) > TAP_SLOP) current.moved = true;
    if (current.view.scale > 1 && current.moved) {
      setDragging(true);
      apply(clamp({ scale: current.view.scale, x: current.view.x + dx, y: current.view.y + dy }), false);
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;
    setDragging(false);
    if (pinch.current) {
      // Lifting one finger of a pinch carries on as a pan with the other, never as a tap or swipe.
      pinch.current = null;
      const [remaining] = [...pointers.current.entries()];
      pan.current = remaining
        ? { x: remaining[1].x, y: remaining[1].y, view: viewRef.current, moved: true, type: event.pointerType }
        : null;
      return;
    }
    const current = pan.current;
    pan.current = null;
    if (!current || event.type === 'pointercancel') return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (current.view.scale <= 1 && current.type !== 'mouse') {
      if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
        onSwipe(dx < 0 ? 1 : -1);
        return;
      }
    }
    if (current.moved) return;
    const point = local(event.clientX, event.clientY);
    if (current.type === 'mouse') {
      toggleAt(point);
      return;
    }
    const previous = lastTap.current;
    if (
      previous &&
      event.timeStamp - previous.time < DOUBLE_TAP_MS &&
      Math.hypot(point.x - previous.x, point.y - previous.y) < 40
    ) {
      lastTap.current = null;
      toggleAt(point);
    } else {
      lastTap.current = { time: event.timeStamp, ...point };
    }
  };

  return (
    <div
      ref={areaRef}
      className="vehicle-photo-dialog-image"
      data-zoomed={zoomed || undefined}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="vehicle-photo-zoom"
        data-animate={animate || undefined}
        style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
