import { useEffect, useState, type CSSProperties } from 'react';
import { supabase } from '../../lib/supabase';
import { MAIN_CALENDAR } from '../../lib/calendars';

const BUCKET = 'quest-images';
const cache = new Map<string, { url: string; expires: number }>();

/** Signed URL for a private photo (quest photos once the day is open; memories for their owner and creator). */
export function useImageUrl(path: string | undefined, bucket: string = BUCKET): string | null {
  const key = path ? `${bucket}:${path}` : '';
  const [url, setUrl] = useState<string | null>(() => (key && cache.get(key)?.url) || null);
  useEffect(() => {
    if (!path) return setUrl(null);
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return setUrl(hit.url);
    let cancelled = false;
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (cancelled || !data?.signedUrl) return;
        cache.set(key, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 });
        setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path, bucket, key]);
  return url;
}

export default function QuestImage({ path, alt = '', className, style, bucket }: { path?: string; alt?: string; className?: string; style?: CSSProperties; bucket?: string }) {
  const url = useImageUrl(path, bucket);
  if (!url) return <span className={`quest-image-loading ${className ?? ''}`} style={style} />;
  return <img src={url} alt={alt} className={className} style={style} draggable={false} />;
}

/** Resize on the device (max 1600px, JPEG) and upload to the day's folder. Returns the storage path. */
export async function uploadQuestImage(day: number, file: File, calendarId: string = MAIN_CALENDAR): Promise<string> {
  const blob = await resizeToJpeg(file);
  // The main calendar keeps "day-07/…"; friend calendars use their own folder.
  const folder = calendarId === MAIN_CALENDAR ? '' : `${calendarId}/`;
  const path = `${folder}day-${String(day).padStart(2, '0')}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw new Error(/row-level security/i.test(error.message) ? 'Photo limit reached for this calendar (100).' : error.message);
  return path;
}

/** Resize a photo on the device (max 1600px) and encode it as JPEG. */
export async function resizeToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not read the photo'))), 'image/jpeg', 0.85));
}
