'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { VEHICLE_PHOTO_PLACEHOLDER } from '@/features/vehicles/domain/vehicle';
import './vehicle-photo-viewer.css';

type Props = {
  photos: string[];
  title: string;
};

function Photo({ src, alt, expanded = false, eager = false }: {
  src: string; alt: string; expanded?: boolean; eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return failed
    ? <span className="vehicle-photo-error" role="status">No pudimos cargar esta foto.</span>
    : <>
      {expanded && !loaded && <span className="vehicle-photo-loading" role="status">Cargando foto…</span>}
      <Image src={src} alt={alt} fill loading={eager ? 'eager' : 'lazy'}
      sizes={expanded ? '100vw' : '(max-width: 980px) 100vw, 72vw'}
      className={expanded ? 'vehicle-photo-contained' : 'cover-image'}
      onLoad={() => setLoaded(true)} onError={() => setFailed(true)} draggable={false} />
    </>;
}

export function VehiclePhotoViewer({ photos, title }: Props) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const ignoreClickUntil = useRef(0);
  const count = photos.length;

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [expanded]);

  // Keeps the current photo's thumbnail centred in the strip as the arrows or swipes move it, without
  // scrolling the page itself.
  useEffect(() => {
    const strip = thumbsRef.current;
    const thumb = strip?.children[index] as HTMLElement | undefined;
    if (!strip || !thumb) return;
    strip.scrollTo({ left: thumb.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2, behavior: 'smooth' });
  }, [index]);

  // Without photos the main slot shows the placeholder, with nothing to enlarge, count or pick.
  if (!count) return <div className="detail-primary-image">
    <Photo src={VEHICLE_PHOTO_PLACEHOLDER} alt={`${title}: foto no disponible`} eager />
  </div>;
  const move = (direction: number) => setIndex(current => (current + direction + count) % count);
  const open = (photoIndex: number, timeStamp: number) => {
    if (timeStamp < ignoreClickUntil.current) return;
    setIndex(photoIndex);
    dialogRef.current?.showModal();
    setExpanded(true);
  };
  const close = () => dialogRef.current?.close();
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowLeft' ? -1 : 1);
    }
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
  const swipeProps = { onPointerDown, onPointerUp, onPointerCancel: () => { gesture.current = null; } };
  const controls = <div className="vehicle-photo-controls">
    {count > 1 && <button type="button" onClick={() => move(-1)} aria-label="Foto anterior"><ChevronLeft aria-hidden="true" size={20} strokeWidth={1.8} /></button>}
    <span role="status" aria-live="polite" aria-atomic="true">{String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}</span>
    {count > 1 && <button type="button" onClick={() => move(1)} aria-label="Foto siguiente"><ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button>}
  </div>;

  return <>
    <div className="detail-primary-image vehicle-photo-carousel" role="region" aria-label={`Fotos de ${title}`} aria-roledescription="carrusel" onKeyDown={onKeyDown}>
      <button type="button" className="vehicle-photo-open" onClick={event => open(index, event.timeStamp)} aria-label={`Ampliar foto ${index + 1} de ${count}`} {...swipeProps}>
        <Photo key={photos[index]} src={photos[index]} alt={`${title} · Foto ${index + 1}`} eager />
      </button>
      {count > 1 && <>
        <button type="button" className="detail-photo-arrow detail-photo-arrow-prev" onClick={() => move(-1)} aria-label="Foto anterior"><ChevronLeft aria-hidden="true" size={20} strokeWidth={1.8} /></button>
        <button type="button" className="detail-photo-arrow detail-photo-arrow-next" onClick={() => move(1)} aria-label="Foto siguiente"><ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button>
      </>}
      <span className="detail-image-count" role="status" aria-live="polite" aria-atomic="true">{String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}</span>
    </div>
    {count > 1 && <div className="detail-photo-thumbs" ref={thumbsRef} role="group" aria-label={`Elegir foto de ${title}`}>
      {photos.map((src, photoIndex) => <button type="button" className="detail-photo-thumb" key={`${src}-${photoIndex}`} onClick={() => setIndex(photoIndex)} aria-label={`Ver foto ${photoIndex + 1} de ${count}`} aria-current={photoIndex === index ? 'true' : undefined}>
        <Image src={src} alt="" fill sizes="104px" className="cover-image" draggable={false} />
      </button>)}
    </div>}

    <dialog ref={dialogRef} className="vehicle-photo-dialog" aria-label={`Fotos ampliadas de ${title}`}
      onClose={() => setExpanded(false)} onKeyDown={onKeyDown}
      onClick={event => { if (event.target === event.currentTarget) close(); }}>
      {expanded && <div className="vehicle-photo-dialog-panel">
        <div className="vehicle-photo-dialog-header"><span>{title}</span><button type="button" className="vehicle-photo-close" onClick={close} aria-label="Cerrar fotos ampliadas" autoFocus><X size={18} strokeWidth={1.8} aria-hidden="true" /></button></div>
        <div className="vehicle-photo-dialog-image" {...swipeProps}>
          <Photo key={photos[index]} src={photos[index]} alt={`${title} · Foto ${index + 1} de ${count}`} expanded eager />
        </div>
        {controls}
      </div>}
    </dialog>
  </>;
}
