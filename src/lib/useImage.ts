import { useEffect, useState } from 'react';
import { getImage } from './db';

export function useImage(id?: string): string | undefined {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let alive = true;
    if (!id) { setSrc(undefined); return; }
    getImage(id).then((v) => { if (alive) setSrc(v); });
    return () => { alive = false; };
  }, [id]);
  return src;
}
