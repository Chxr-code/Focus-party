import { useEffect, useState } from 'react';
import { composePet } from '../pets/pets.js';

export default function Pet({ pet, size = 40, className = '', title }) {
  const [src, setSrc] = useState(null);
  const key = `${pet?.type}|${pet?.color}`;

  useEffect(() => {
    let alive = true;
    composePet(pet).then((url) => alive && setSrc(url)).catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!pet?.type || !src) return null;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={title ?? pet.name ?? ''}
      title={title ?? pet.name ?? undefined}
      className={`pet pixelated ${className}`}
    />
  );
}
