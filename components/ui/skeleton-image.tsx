'use client';

import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';
import './skeleton-image.css';

/**
 * A `fill` image that shimmers in its slot until the photo arrives, or fails. The slot must be
 * positioned, as `fill` already requires.
 */
export function SkeletonImage({ onLoad, onError, alt, ...props }: ImageProps) {
  const [settled, setSettled] = useState(false);
  return (
    <>
      {!settled && <span className="image-skeleton" aria-hidden="true" />}
      <Image
        {...props}
        alt={alt}
        onLoad={event => {
          setSettled(true);
          onLoad?.(event);
        }}
        onError={event => {
          setSettled(true);
          onError?.(event);
        }}
      />
    </>
  );
}
