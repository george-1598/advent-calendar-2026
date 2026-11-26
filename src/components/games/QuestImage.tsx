import { useEffect, useState, type CSSProperties } from 'react';
import { supabase } from '../../lib/supabase';

const BUCKET = 'quest-images';
const cache = new Map<string, { url: string; expires: number }>();

/** Signed URL for a private quest photo (allowed once the day is open, or for admins). */
export function useImageUrl(path: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (path && cache.get(path)?.url) || null);
  useEffect(() => {
    if (!path) return setUrl(null);
    const hit = cache.get(path);
    if (hit && hit.expires > Date.now()) return setUrl(hit.url);
    let cancelled = false;
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (cancelled || !data?.signedUrl) return;
        cache.set(path, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 });
        setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return url;
}

export default function QuestImage({ path, alt = '', className, style }: { path?: string; alt?: string; className?: string; style?: CSSProperties }) {
  const url = useImageUrl(path);
  if (!url) return <span className={`quest-image-loading ${className ?? ''}`} style={style} />;
  return <img src={url} alt={alt} className={className} style={style} draggable={false} />;
}

/** Resize on the device (max 1600px, JPEG) and upload to the day's folder. Returns the storage path. */
export async function uploadQuestImage(day: number, file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not read the photo'))), 'image/jpeg', 0.85));
  const path = `day-${String(day).padStart(2, '0')}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw new Error(error.message);
  return path;
}
