import { between, rng } from '../../../lib/random';

/**
 * Procedural gold foil: warm metallic gradient, crinkle facets, a fine woven
 * grain, embossed stars and speckle — generated once and reused for every card.
 */
const SIZE = 512;
let texture: HTMLCanvasElement | null = null;
let dataUrl: string | null = null;

function star(g: CanvasRenderingContext2D, x: number, y: number, R: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? R * 0.45 : R;
    g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  g.closePath();
  g.fill();
}

export function foilTexture(): HTMLCanvasElement {
  if (texture) return texture;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d')!;
  const r = rng(2412);

  const base = g.createLinearGradient(0, 0, SIZE, SIZE);
  base.addColorStop(0, '#a8740f');
  base.addColorStop(0.22, '#f0c64a');
  base.addColorStop(0.4, '#ffe9a6');
  base.addColorStop(0.58, '#d6a124');
  base.addColorStop(0.78, '#f7d46a');
  base.addColorStop(1, '#aa7612');
  g.fillStyle = base;
  g.fillRect(0, 0, SIZE, SIZE);

  // Crinkled facets.
  g.globalCompositeOperation = 'soft-light';
  for (let i = 0; i < 220; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const s = between(r, 20, 110);
    const light = r() < 0.5;
    g.fillStyle = light ? `rgba(255,250,220,${between(r, 0.15, 0.45)})` : `rgba(90,45,0,${between(r, 0.12, 0.4)})`;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + between(r, -s, s), y + between(r, -s, s));
    g.lineTo(x + between(r, -s, s), y + between(r, -s, s));
    g.closePath();
    g.fill();
  }

  // Fine woven grain.
  g.globalCompositeOperation = 'source-over';
  for (let x = 0; x < SIZE; x += 2) {
    g.fillStyle = `rgba(95,55,0,${x % 4 ? 0.05 : 0.08})`;
    g.fillRect(x, 0, 1, SIZE);
  }
  for (let y = 0; y < SIZE; y += 3) {
    g.fillStyle = 'rgba(255,240,190,0.035)';
    g.fillRect(0, y, SIZE, 1);
  }

  // Embossed stars: shadow down-right, highlight up-left, gold face.
  const step = 32;
  for (let row = 0; row * step < SIZE + step; row++) {
    for (let col = 0; col * step < SIZE + step; col++) {
      const x = col * step + (row % 2 ? step / 2 : 0) + between(r, -2, 2);
      const y = row * step + between(r, -2, 2);
      const R = between(r, 5.5, 7);
      g.fillStyle = 'rgba(100,52,0,0.5)';
      star(g, x + 1.3, y + 1.3, R);
      g.fillStyle = 'rgba(255,246,205,0.7)';
      star(g, x - 1, y - 1, R);
      g.fillStyle = 'rgba(214,152,30,0.92)';
      star(g, x, y, R * 0.92);
    }
  }

  // Speckle.
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,230,0.18)' : 'rgba(80,40,0,0.15)';
    g.fillRect(r() * SIZE, r() * SIZE, 1, 1);
  }

  // Broad sheen.
  const sheen = g.createLinearGradient(0, SIZE, SIZE, 0);
  sheen.addColorStop(0.3, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.5, 'rgba(255,255,240,0.28)');
  sheen.addColorStop(0.7, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, SIZE, SIZE);

  texture = c;
  return c;
}

export function foilDataUrl(): string {
  dataUrl ??= foilTexture().toDataURL('image/jpeg', 0.86);
  return dataUrl;
}

export const FOIL_SIZE = SIZE;
