'use client';

import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ChevronUp, Scale, X } from 'lucide-react';

import { useDialogMotion } from '@/components/motion/use-dialog-motion';
import { Button } from '@/components/ui/button';
import type { Vehicle } from '@/features/vehicles/domain/vehicle';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

type VehicleCompareDockProps = {
  maximum: number;
  onClear: () => void;
  onCompare: () => void;
  onRemove: (slug: string) => void;
  vehicles: Vehicle[];
};

const MINIMUM_TO_COMPARE = 2;
const vehicleList = new Intl.ListFormat('es-AR', { type: 'conjunction' });

const getVehicleName = ({ make, model }: Vehicle) => `${make} ${model}`;

function getSelectionHint(count: number, maximum: number) {
  if (count < MINIMUM_TO_COMPARE) return `Elegí ${MINIMUM_TO_COMPARE - count} más para comparar`;
  if (count >= maximum) return 'Llegaste al máximo';
  return `Podés sumar ${maximum - count} más`;
}

function getStatusMessage(vehicles: Vehicle[], maximum: number) {
  if (vehicles.length === 0) return '';
  const names = vehicleList.format(vehicles.map(getVehicleName));
  return `${vehicles.length} de ${maximum} seleccionados: ${names}. ${getSelectionHint(vehicles.length, maximum)}.`;
}

/** The dock is fixed to the viewport, so it steps aside while the page footer is on screen. */
function useFooterInView() {
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const footer = document.querySelector('.site-footer');
    if (!footer) return;

    const observer = new IntersectionObserver(([entry]) => setIsInView(entry.isIntersecting));
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  return isInView;
}

export function VehicleCompareDock({ maximum, onClear, onCompare, onRemove, vehicles }: VehicleCompareDockProps) {
  const root = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selectionId = useId();
  const [isSelectionOpen, setIsSelectionOpen] = useState(false);
  const isFooterInView = useFooterInView();
  const { closeDialog, closeDialogAfter, dialogRef } = useDialogMotion({
    isOpen: isSelectionOpen,
    // Not the header: it holds the autofocused close button, which would lose focus while the
    // stagger briefly hides it.
    itemSelector: '.compare-selection-item, .compare-selection-footer',
    panelSelector: '.compare-selection-panel',
    variant: 'compare',
  });

  const count = vehicles.length;
  const canCompare = count >= MINIMUM_TO_COMPARE;
  const isVisible = count > 0 && !isFooterInView;
  const vehicleKey = vehicles.map(({ slug }) => slug).join('|');
  const hint = getSelectionHint(count, maximum);

  useGSAP(
    () => {
      const shell = root.current;
      if (!shell) return;

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(shell, { autoAlpha: isVisible ? 1 : 0, y: 0 });
        return;
      }

      gsap.to(shell, {
        y: isVisible ? 0 : 34,
        autoAlpha: isVisible ? 1 : 0,
        duration: isVisible ? 0.5 : 0.32,
        ease: isVisible ? 'power3.out' : 'power2.inOut',
        overwrite: 'auto',
      });
    },
    { scope: root, dependencies: [isVisible], revertOnUpdate: false },
  );

  useGSAP(
    () => {
      if (count === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      gsap.fromTo(
        '.compare-dock-thumb, .compare-dock-avatar',
        { scale: 0.78, x: 14, autoAlpha: 0 },
        { scale: 1, x: 0, autoAlpha: 1, stagger: 0.055, duration: 0.42, ease: 'back.out(1.5)' },
      );
      gsap.fromTo(
        '.compare-dock-heading > span',
        { scale: 0.75 },
        { scale: 1, duration: 0.42, ease: 'back.out(1.7)' },
      );
    },
    { scope: root, dependencies: [vehicleKey], revertOnUpdate: false },
  );

  const removeVehicle = (slug: string, index: number) => {
    if (count === 1) {
      closeDialogAfter(() => onRemove(slug));
      return;
    }

    onRemove(slug);
    // Keep focus inside the sheet: move it to the row that took the removed one's place.
    requestAnimationFrame(() => {
      const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('.compare-selection-remove');
      buttons?.[Math.min(index, buttons.length - 1)]?.focus();
    });
  };

  return (
    <>
      <p className="sr-only" role="status">{getStatusMessage(vehicles, maximum)}</p>
      <div
        className="compare-dock-shell"
        aria-hidden={!isVisible}
        data-visible={isVisible}
        inert={!isVisible}
        ref={root}
      >
        {/* The full dock wherever it fits; the compact one below 741px (see globals.css). */}
        <div className="compare-dock compare-dock-wide glass-panel">
          <div className="compare-dock-heading">
            <span><Scale aria-hidden="true" size={17} strokeWidth={1.8} /></span>
            <div><strong>Comparar vehículos</strong><small>{count} de {maximum} seleccionados</small></div>
          </div>
          <div className="compare-dock-slots">
            {vehicles.map((vehicle) => (
              <div className="compare-dock-thumb" key={vehicle.slug}>
                <Image src={vehicle.image} alt="" fill sizes="76px" className="cover-image" />
                <button type="button" aria-label={`Quitar ${getVehicleName(vehicle)}`} onClick={() => onRemove(vehicle.slug)}>
                  <X aria-hidden="true" size={11} />
                </button>
              </div>
            ))}
            {Array.from({ length: Math.max(0, maximum - count) }, (_, index) => (
              <div className="compare-dock-empty" aria-hidden="true" key={index}>+</div>
            ))}
          </div>
          <div className="compare-dock-actions">
            <button className="compare-dock-clear" type="button" onClick={onClear}>Limpiar</button>
            <Button type="button" disabled={!canCompare} onClick={onCompare}>
              Comparar {count > 1 ? count : ''} <Scale aria-hidden="true" size={15} strokeWidth={1.8} />
            </Button>
          </div>
        </div>

        <div className="compare-dock compare-dock-compact glass-panel">
          <button
            className="compare-dock-summary"
            type="button"
            aria-controls={selectionId}
            aria-expanded={isSelectionOpen}
            aria-haspopup="dialog"
            onClick={() => setIsSelectionOpen(true)}
          >
            <span className="compare-dock-avatars" aria-hidden="true">
              {vehicles.map((vehicle) => (
                <span className="compare-dock-avatar" key={vehicle.slug}>
                  <Image src={vehicle.image} alt="" fill sizes="40px" className="cover-image" />
                </span>
              ))}
              {Array.from({ length: Math.max(0, maximum - count) }, (_, index) => (
                <span className="compare-dock-avatar-empty" data-next={index === 0} key={index} />
              ))}
            </span>
            <span className="compare-dock-copy">
              <strong>
                {canCompare ? <>{count} de {maximum}<span className="compare-dock-copy-extra"> elegidos</span></> : hint}
              </strong>
              <small>
                {canCompare ? (count >= maximum ? hint : 'Ver o quitar') : `${count} de ${maximum} · Ver selección`}
              </small>
            </span>
            <ChevronUp aria-hidden="true" size={18} strokeWidth={1.8} />
          </button>
          {canCompare ? (
            <Button type="button" onClick={onCompare}>
              Comparar {count} <Scale aria-hidden="true" size={15} strokeWidth={1.8} />
            </Button>
          ) : null}
        </div>
      </div>

      <dialog
        className="compare-selection-dialog"
        id={selectionId}
        ref={dialogRef}
        aria-labelledby={`${selectionId}-title`}
        aria-describedby={`${selectionId}-hint`}
        onClose={() => setIsSelectionOpen(false)}
        onCancel={(event) => { event.preventDefault(); closeDialog(); }}
        onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }}
      >
        <div className="compare-selection-panel">
          <header className="compare-selection-header">
            <div>
              <strong id={`${selectionId}-title`}>Tu comparación</strong>
              <small id={`${selectionId}-hint`}>{count} de {maximum} · {hint}</small>
            </div>
            <button
              className="compare-selection-icon-button"
              type="button"
              aria-label="Cerrar selección"
              onClick={closeDialog}
              // showModal() focuses the [autofocus] element. React's `autoFocus` prop only focuses on
              // mount and never writes the attribute.
              ref={(button) => button?.setAttribute('autofocus', '')}
            >
              <X aria-hidden="true" size={18} />
            </button>
          </header>
          <ul className="compare-selection-list" ref={listRef}>
            {vehicles.map((vehicle, index) => (
              <li className="compare-selection-item" key={vehicle.slug}>
                <span className="compare-selection-image">
                  <Image src={vehicle.image} alt="" fill sizes="72px" className="cover-image" />
                </span>
                <div>
                  <p>{vehicle.year}</p>
                  <strong>{getVehicleName(vehicle)}</strong>
                </div>
                <button
                  className="compare-selection-icon-button compare-selection-remove"
                  type="button"
                  aria-label={`Quitar ${getVehicleName(vehicle)}`}
                  onClick={() => removeVehicle(vehicle.slug, index)}
                >
                  <X aria-hidden="true" size={16} />
                </button>
              </li>
            ))}
          </ul>
          <footer className="compare-selection-footer">
            <Button type="button" variant="ghost" onClick={() => closeDialogAfter(onClear)}>Limpiar</Button>
            <Button type="button" disabled={!canCompare} onClick={() => closeDialogAfter(onCompare)}>
              {canCompare ? <>Comparar {count} <Scale aria-hidden="true" size={15} strokeWidth={1.8} /></> : hint}
            </Button>
          </footer>
        </div>
      </dialog>
    </>
  );
}
