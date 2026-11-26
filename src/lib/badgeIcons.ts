/** Each day's badge: a festive icon (the phrase characters stay hidden until the end). */
export const BADGE_ICONS = [
  '🍬', '🎁', '🎄', '⛄', '🍪', '🔔', '🧦', '🦌', '🕯️', '🍭', '🎅', '🧁', '🥨',
  '🎀', '🛷', '❄️', '🍫', '🧸', '🎶', '🌟', '☕', '🍊', '🧤', '🏠', '⭐',
] as const;

export const badgeIcon = (day: number) => BADGE_ICONS[(day - 1) % BADGE_ICONS.length];
