'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ImagePlus, X } from 'lucide-react';

type SelectedPhoto = {
  file: File;
  id: string;
  previewUrl: string;
};

function getFileId(file: File) {
  return `${file.name}-${file.lastModified}-${file.size}`;
}

function createSelectedPhotos(files: File[]) {
  return files.map((file) => ({
    file,
    id: getFileId(file),
    previewUrl: URL.createObjectURL(file),
  }));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VehiclePhotoUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const dragDepthRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<SelectedPhoto[]>([]);

  useEffect(() => () => {
    photosRef.current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
  }, []);

  const syncInputFiles = (nextPhotos: SelectedPhoto[]) => {
    if (!inputRef.current || typeof DataTransfer === 'undefined') return;
    const transfer = new DataTransfer();
    nextPhotos.forEach(({ file }) => transfer.items.add(file));
    inputRef.current.files = transfer.files;
  };

  const addFiles = (files: File[]) => {
    const existingIds = new Set(photosRef.current.map(({ id }) => id));
    const newFiles = files.filter((file) => file.type.startsWith('image/') && !existingIds.has(getFileId(file)));
    if (newFiles.length === 0) {
      syncInputFiles(photosRef.current);
      return;
    }

    const nextPhotos = [...photosRef.current, ...createSelectedPhotos(newFiles)];
    photosRef.current = nextPhotos;
    setPhotos(nextPhotos);
    syncInputFiles(nextPhotos);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
  };

  const handleDragEnter = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  const removePhoto = (id: string) => {
    const photo = photosRef.current.find((item) => item.id === id);
    if (photo) URL.revokeObjectURL(photo.previewUrl);

    const remainingPhotos = photosRef.current.filter((item) => item.id !== id);
    photosRef.current = remainingPhotos;
    setPhotos(remainingPhotos);

    syncInputFiles(remainingPhotos);
  };

  const photoCount = photos.length;

  return (
    <div className="valuation-photo-field valuation-field-wide">
      <label
        className={`valuation-file-field${isDragging ? ' is-dragging' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <ImagePlus aria-hidden="true" size={20} />
        <span>
          <strong>{isDragging ? 'Soltá las fotos acá' : 'Agregar fotos del vehículo'}</strong>
          <small>
            {isDragging
              ? 'Se agregarán a tu selección actual'
              : photoCount > 0
              ? `Exterior, interior y tablero · ${photoCount} ${photoCount === 1 ? 'seleccionada' : 'seleccionadas'}`
              : 'Exterior, interior y tablero · Opcional'}
          </small>
        </span>
        <input ref={inputRef} name="photos" type="file" accept="image/*" multiple onChange={handleChange} />
      </label>

      {photoCount > 0 ? (
        <div className="valuation-photo-previews" aria-live="polite" aria-label={`${photoCount} fotos seleccionadas`}>
          {photos.map((photo) => (
            <div className="valuation-photo-preview" key={photo.id}>
              <div className="valuation-photo-image">
                <Image src={photo.previewUrl} alt={`Vista previa de ${photo.file.name}`} fill sizes="140px" unoptimized />
              </div>
              <div className="valuation-photo-meta">
                <strong title={photo.file.name}>{photo.file.name}</strong>
                <small>{formatFileSize(photo.file.size)}</small>
              </div>
              <button type="button" aria-label={`Quitar ${photo.file.name}`} onClick={() => removePhoto(photo.id)}>
                <X aria-hidden="true" size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
