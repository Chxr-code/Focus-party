import { useEffect, useState } from 'react';
import { composeAvatar } from '../avatar/compose.js';

// framed = square badge with a border (lobby, player bar)
// framed={false} = just the character, for standing in the scene
export default function Avatar({ avatar, size = 48, title, framed = true, className = '' }) {
  const [src, setSrc] = useState(null);
  const key = JSON.stringify(avatar ?? {});

  useEffect(() => {
    let alive = true;
    composeAvatar(avatar)
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const frameStyle = framed
    ? { border: '3px solid var(--ink)', background: '#cfe8b6' }
    : {};

  return (
    <span
      className={`avatar ${framed ? 'framed' : ''} ${className}`}
      style={{ width: size, height: size, display: 'block', flexShrink: 0, overflow: 'hidden', ...frameStyle }}
      title={title}
    >
      {src && (
        <img
          src={src}
          alt={title || 'avatar'}
          className="pixelated"
          style={
            framed
              ? // zoom to head + shoulders inside the badge
                { width: '190%', height: '190%', margin: '-40% 0 0 -47%', display: 'block' }
              : { width: '100%', height: '100%', display: 'block' }
          }
        />
      )}
    </span>
  );
}
