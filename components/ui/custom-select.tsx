'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

type CustomSelectOption = {
  value: string;
  label: string;
};

type CustomSelectProps = {
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
};

export function CustomSelect({
  value,
  options,
  onChange,
  ariaLabel,
  name,
  placeholder = 'Seleccionar',
  required = false,
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Buscar…',
  emptyMessage = 'No hay resultados.',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuId = useId();
  const selectedOption = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  const filteredOptions = normalizedQuery
    ? options.filter((option) => option.label.toLocaleLowerCase('es').includes(normalizedQuery))
    : options;
  const menuIsOpen = isOpen && !disabled;

  useEffect(() => {
    if (menuIsOpen && searchable) requestAnimationFrame(() => searchRef.current?.focus());
  }, [menuIsOpen, searchable]);

  useEffect(() => {
    if (!menuIsOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuIsOpen]);

  const focusOption = (position: 'first' | 'last' | 'selected') => {
    requestAnimationFrame(() => {
      const buttons = rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
      if (!buttons?.length) return;
      const selectedIndex = Array.from(buttons).findIndex((button) => button.dataset.value === value);
      const index = position === 'first' ? 0 : position === 'last' ? buttons.length - 1 : Math.max(selectedIndex, 0);
      buttons[index]?.focus();
    });
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      if (!searchable) focusOption(event.key === 'ArrowDown' ? 'selected' : 'last');
    }
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!buttons.length) return;
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = currentIndex < 0
        ? (direction === 1 ? 0 : buttons.length - 1)
        : (currentIndex + direction + buttons.length) % buttons.length;
      buttons[nextIndex]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      focusOption(event.key === 'Home' ? 'first' : 'last');
    }
  };

  const selectOption = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
    setQuery('');
    triggerRef.current?.removeAttribute('aria-invalid');
    triggerRef.current?.focus();
  };

  return (
    <div className="custom-select" ref={rootRef}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        className="custom-select-trigger"
        type="button"
        ref={triggerRef}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={menuIsOpen}
        aria-controls={menuId}
        disabled={disabled}
        data-required-select={required || undefined}
        data-value={value}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={selectedOption ? '' : 'is-placeholder'}>{selectedOption?.label ?? placeholder}</span>
        <ChevronDown aria-hidden="true" size={15} className={menuIsOpen ? 'is-open' : ''} />
      </button>

      {menuIsOpen && (
        <div className="custom-select-menu glass-panel" onKeyDown={handleMenuKeyDown}>
          {searchable && (
            <div className="custom-select-search">
              <Search aria-hidden="true" size={14} />
              <label className="sr-only" htmlFor={`${menuId}-search`}>Buscar opción</label>
              <input
                id={`${menuId}-search`}
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                autoComplete="off"
              />
              {query ? (
                <button
                  className="search-clear-button"
                  type="button"
                  aria-label="Limpiar búsqueda de opciones"
                  onClick={() => {
                    setQuery('');
                    searchRef.current?.focus();
                  }}
                >
                  <X aria-hidden="true" size={13} strokeWidth={1.8} />
                </button>
              ) : null}
            </div>
          )}
          <div className="custom-select-options" id={menuId} role="listbox" aria-label={ariaLabel}>
            {filteredOptions.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={value === option.value}
                className={value === option.value ? 'is-selected' : ''}
                data-value={option.value}
                onClick={() => selectOption(option.value)}
                key={option.value}
              >
                <span>{option.label}</span>
                {value === option.value && <Check aria-hidden="true" size={14} />}
              </button>
            ))}
            {filteredOptions.length === 0 && <p className="custom-select-empty">{emptyMessage}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
