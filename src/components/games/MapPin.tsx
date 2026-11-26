import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GameProps } from './types';
import { useGameSubmit } from './useSubmit';

export const pinIcon = L.divIcon({ className: 'map-pin', html: '📍', iconSize: [30, 30], iconAnchor: [15, 28] });
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '© OpenStreetMap contributors';

export const formatDistance = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`);

export default function MapPin({ day, content, solved }: GameProps) {
  const el = useRef<HTMLDivElement>(null);
  const marker = useRef<L.Marker | null>(null);
  const [pin, setPin] = useState<L.LatLng | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { busy, error, run } = useGameSubmit(day);

  useEffect(() => {
    const map = L.map(el.current!, { zoomControl: true }).setView(content.center ?? [48, 15], content.zoom ?? 4);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (marker.current) marker.current.setLatLng(e.latlng);
      else marker.current = L.marker(e.latlng, { icon: pinIcon }).addTo(map);
      setPin(e.latlng);
      setMessage(null);
    });
    return () => {
      map.remove();
      marker.current = null;
    };
  }, [content.center, content.zoom]);

  const guess = async () => {
    if (!pin) return;
    const res = await run(`${pin.lat.toFixed(6)},${pin.lng.toFixed(6)}`);
    if (res && !res.correct) {
      setMessage(res.distance_m !== undefined ? `Not quite — about ${formatDistance(res.distance_m)} away.` : 'Not quite!');
    }
  };

  return (
    <div className="game map-game">
      {content.prompt && <p className="day-prompt">{content.prompt}</p>}
      <div ref={el} className="map-box" />
      {!solved && (
        <>
          <p className="game-help">{pin ? 'Happy with your pin?' : 'Tap the map to drop a pin. Zoom in for precision.'}</p>
          <button className="game-primary" onClick={guess} disabled={!pin || busy}>
            {busy ? 'Checking…' : 'Is it here?'}
          </button>
        </>
      )}
      {message && <p className="form-error">{message}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
