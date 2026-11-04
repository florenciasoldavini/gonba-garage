'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight, LayoutGrid, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { VEHICLE_PHOTO_PLACEHOLDER } from '@/features/vehicles/domain/vehicle';
import { mercadoLibreWebpUrl } from '@/lib/integrations/mercado-libre/pictures';
import { VehiclePhotoZoom, type PhotoZoomHandle } from './vehicle-photo-zoom';
import './vehicle-photo-viewer.css';

type Props = {
  photos: string[];
  /** The full name, for labels and alt text. */
  title: string;
  /** Make and model, shown over the expanded photo. */
  name: string;
  /** The version, shown under the name. */
  version?: string;
};

function Photo({
  src,
  alt,
  expanded = false,
  eager = false,
}: {
  src: string;
  alt: string;
  expanded?: boolean;
  eager?: boolean;
}) {
  const webp = mercadoLibreWebpUrl(src);
  const [useWebp, setUseWebp] = useState(Boolean(webp));
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return failed ? (
    <span className="vehicle-photo-error" role="status">
      No pudimos cargar esta foto.
    </span>
  ) : (
    <>
      {expanded && !loaded && (
        <span className="vehicle-photo-loading" role="status">
          Cargando foto…
        </span>
      )}
      {/* The main and expanded photos show Mercado Libre's full-size file as is, never re-encoded: its
          WebP when it has one, else the original. One URL per photo, so opening it expanded reuses the
          download. */}
      <Image
        src={useWebp && webp ? webp : src}
        alt={alt}
        fill
        unoptimized
        loading={eager ? 'eager' : 'lazy'}
        className={expanded ? 'vehicle-photo-contained' : 'cover-image'}
        onLoad={() => setLoaded(true)}
        onError={() => (useWebp ? setUseWebp(false) : setFailed(true))}
        draggable={false}
      />
    </>
  );
}

export function VehiclePhotoViewer({ photos, title, name, version }: Props) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [focusClose, setFocusClose] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [coarsePointer, setCoarsePointer] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [thumbEdges, setThumbEdges] = useState({ start: false, end: false });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const zoomRef = useRef<PhotoZoomHandle>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const ignoreClickUntil = useRef(0);
  const count = photos.length;

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  // The zoom hint shows for a few seconds after opening, then gets out of the photo's way.
  useEffect(() => {
    if (!showHint) return;
    const timer = window.setTimeout(() => setShowHint(false), 3500);
    return () => window.clearTimeout(timer);
  }, [showHint]);

  // Opening the grid puts focus on the photo being shown, so the keyboard starts from there.
  useEffect(() => {
    if (!showGrid) return;
    const current = gridRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    current?.focus({ preventScroll: true });
    current?.scrollIntoView({ block: 'nearest' });
  }, [showGrid]);

  // Keeps the current photo's thumbnail centred in the strip as the arrows or swipes move it, without
  // scrolling the page itself.
  useEffect(() => {
    const strip = thumbsRef.current;
    const thumb = strip?.children[index] as HTMLElement | undefined;
    if (!strip || !thumb) return;
    strip.scrollTo({ left: thumb.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2, behavior: 'smooth' });
  }, [index]);

  // Tracks whether the strip has hidden thumbnails on either side, which shows that side's fade and arrow.
  useEffect(() => {
    const strip = thumbsRef.current;
    if (!strip) return;
    const update = () =>
      setThumbEdges({
        start: strip.scrollLeft > 1,
        end: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1,
      });
    update();
    strip.addEventListener('scroll', update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(strip);
    return () => {
      strip.removeEventListener('scroll', update);
      resize.disconnect();
    };
  }, [count]);

  // Without photos the main slot shows the placeholder, with nothing to enlarge, count or pick.
  if (!count)
    return (
      <div className="detail-primary-image">
        <Photo src={VEHICLE_PHOTO_PLACEHOLDER} alt={`${title}: foto no disponible`} eager />
      </div>
    );
  const move = (direction: number) => {
    setZoomed(false);
    setIndex(current => (current + direction + count) % count);
  };
  const open = (photoIndex: number, timeStamp: number) => {
    if (timeStamp < ignoreClickUntil.current) return;
    // A tap gives the browser no focus to go on, so it would ring the close button. Tap and click opens
    // start on the dialog itself; keyboard opens start on the close button.
    const openedByKeyboard = document.activeElement?.matches(':focus-visible') ?? false;
    setIndex(photoIndex);
    setFocusClose(openedByKeyboard);
    setCoarsePointer(window.matchMedia('(pointer: coarse)').matches);
    setShowGrid(false);
    setShowHint(true);
    dialogRef.current?.showModal();
    if (!openedByKeyboard) dialogRef.current?.focus({ preventScroll: true });
    setExpanded(true);
  };
  const close = () => dialogRef.current?.close();
  const scrollThumbs = (direction: number) => {
    const strip = thumbsRef.current;
    strip?.scrollBy({ left: direction * strip.clientWidth * 0.8, behavior: 'smooth' });
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowLeft' ? -1 : 1);
    }
  };
  const onDialogKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || showGrid) return;
    if (event.key === '+' || event.key === '=' || event.key === '-') {
      event.preventDefault();
      zoomRef.current?.zoomBy(event.key === '-' ? 1 / 1.5 : 1.5);
      return;
    }
    onKeyDown(event);
  };
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' || !event.isPrimary) {
      gesture.current = null;
      return;
    }
    gesture.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = gesture.current;
    gesture.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
      ignoreClickUntil.current = event.timeStamp + 400;
      move(dx < 0 ? 1 : -1);
    }
  };
  const swipeProps = {
    onPointerDown,
    onPointerUp,
    onPointerCancel: () => {
      gesture.current = null;
    },
  };
  const counter = `${String(index + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`;
  const hint = coarsePointer ? 'Pellizcá o tocá dos veces para acercar' : 'Hacé clic o usá la rueda para acercar';

  return (
    <>
      <div
        className="detail-primary-image vehicle-photo-carousel"
        role="region"
        aria-label={`Fotos de ${title}`}
        aria-roledescription="carrusel"
        onKeyDown={onKeyDown}
      >
        <button
          type="button"
          className="vehicle-photo-open"
          onClick={event => open(index, event.timeStamp)}
          aria-label={`Ampliar foto ${index + 1} de ${count}`}
          {...swipeProps}
        >
          <Photo key={photos[index]} src={photos[index]} alt={`${title} · Foto ${index + 1}`} eager />
        </button>
        {count > 1 && (
          <>
            <button
              type="button"
              className="detail-photo-arrow detail-photo-arrow-prev"
              onClick={() => move(-1)}
              aria-label="Foto anterior"
            >
              <ChevronLeft aria-hidden="true" size={20} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="detail-photo-arrow detail-photo-arrow-next"
              onClick={() => move(1)}
              aria-label="Foto siguiente"
            >
              <ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} />
            </button>
          </>
        )}
        <span className="detail-image-count" role="status" aria-live="polite" aria-atomic="true">
          {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
        </span>
      </div>
      {count > 1 && (
        <div
          className="detail-photo-rail"
          data-more-before={thumbEdges.start || undefined}
          data-more-after={thumbEdges.end || undefined}
        >
          <div className="detail-photo-thumbs" ref={thumbsRef} role="group" aria-label={`Elegir foto de ${title}`}>
            {photos.map((src, photoIndex) => (
              <button
                type="button"
                className="detail-photo-thumb"
                key={`${src}-${photoIndex}`}
                onClick={() => setIndex(photoIndex)}
                aria-label={`Ver foto ${photoIndex + 1} de ${count}`}
                aria-current={photoIndex === index ? 'true' : undefined}
              >
                <Image src={src} alt="" fill sizes="104px" className="cover-image" draggable={false} />
              </button>
            ))}
          </div>
          {/* Pointer shortcuts only: the keyboard reaches every thumbnail by Tab, which scrolls it into view. */}
          {thumbEdges.start && (
            <button
              type="button"
              className="detail-photo-rail-arrow detail-photo-rail-arrow-prev"
              onClick={() => scrollThumbs(-1)}
              tabIndex={-1}
              aria-hidden="true"
            >
              <ChevronLeft size={20} strokeWidth={1.8} />
            </button>
          )}
          {thumbEdges.end && (
            <button
              type="button"
              className="detail-photo-rail-arrow detail-photo-rail-arrow-next"
              onClick={() => scrollThumbs(1)}
              tabIndex={-1}
              aria-hidden="true"
            >
              <ChevronRight size={20} strokeWidth={1.8} />
            </button>
          )}
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="vehicle-photo-dialog"
        tabIndex={-1}
        aria-label={`Fotos ampliadas de ${title}`}
        onClose={() => {
          setExpanded(false);
          setZoomed(false);
          setShowGrid(false);
        }}
        onCancel={event => {
          // Escape from the grid goes back to the photo; from the photo it closes.
          if (!showGrid) return;
          event.preventDefault();
          setShowGrid(false);
        }}
        onKeyDown={onDialogKeyDown}
      >
        {expanded && (
          <div className="vehicle-photo-dialog-panel">
            {showGrid ? (
              <div className="vehicle-photo-grid" ref={gridRef} role="group" aria-label={`Todas las fotos de ${title}`}>
                {photos.map((src, photoIndex) => (
                  <button
                    type="button"
                    className="vehicle-photo-grid-item"
                    key={`${src}-${photoIndex}`}
                    onClick={() => {
                      setIndex(photoIndex);
                      setShowGrid(false);
                    }}
                    aria-label={`Ver foto ${photoIndex + 1} de ${count}`}
                    aria-current={photoIndex === index ? 'true' : undefined}
                  >
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="(max-width: 760px) 33vw, (max-width: 1200px) 25vw, 17vw"
                      className="cover-image"
                      draggable={false}
                    />
                  </button>
                ))}
              </div>
            ) : (
              <VehiclePhotoZoom key={photos[index]} ref={zoomRef} onSwipe={move} onZoomChange={setZoomed}>
                <Photo src={photos[index]} alt={`${title} · Foto ${index + 1} de ${count}`} expanded eager />
              </VehiclePhotoZoom>
            )}
            <div className="vehicle-photo-dialog-top">
              <p className="vehicle-photo-dialog-name">
                <strong>{name}</strong>
                {version && <span>{version}</span>}
              </p>
              <button
                type="button"
                className="vehicle-photo-round-button"
                onClick={close}
                aria-label="Cerrar fotos ampliadas"
                autoFocus={focusClose}
              >
                <X size={18} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
            <p className="vehicle-photo-hint" data-hidden={!showHint || zoomed || showGrid || undefined}>
              {hint}
            </p>
            <div className="vehicle-photo-pill">
              {count > 1 && (
                <button type="button" onClick={() => move(-1)} aria-label="Foto anterior">
                  <ChevronLeft aria-hidden="true" size={20} strokeWidth={1.8} />
                </button>
              )}
              <span className="vehicle-photo-pill-count" role="status" aria-live="polite" aria-atomic="true">
                {counter}
              </span>
              {count > 1 && (
                <button type="button" onClick={() => move(1)} aria-label="Foto siguiente">
                  <ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} />
                </button>
              )}
              <span className="vehicle-photo-pill-divider" aria-hidden="true" />
              {count > 1 && (
                <button
                  type="button"
                  onClick={() => setShowGrid(current => !current)}
                  aria-label={showGrid ? 'Volver a la foto' : 'Ver todas las fotos'}
                  aria-pressed={showGrid}
                >
                  <LayoutGrid aria-hidden="true" size={18} strokeWidth={1.8} />
                </button>
              )}
              <button
                type="button"
                onClick={() => zoomRef.current?.toggle()}
                aria-label={zoomed ? 'Alejar foto' : 'Acercar foto'}
                aria-pressed={zoomed}
                disabled={showGrid}
              >
                {zoomed ? (
                  <ZoomOut aria-hidden="true" size={18} strokeWidth={1.8} />
                ) : (
                  <ZoomIn aria-hidden="true" size={18} strokeWidth={1.8} />
                )}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
