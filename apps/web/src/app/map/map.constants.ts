export const CATEGORY_COLOR: Record<string, string> = {
  cafe: '#795548',
  restaurant: '#F44336',
  photospot: '#9C27B0',
  bar: '#FF9800',
  culture: '#2196F3',
  nature: '#4CAF50',
  shopping: '#E91E63',
  street: '#607D8B',
};

export const NATIONALITY_FLAGS: Record<string, string> = {
  KR: '🇰🇷',
  JP: '🇯🇵',
  US: '🇺🇸',
  CN: '🇨🇳',
  TW: '🇹🇼',
  ES: '🇪🇸',
  RU: '🇷🇺',
  GB: '🇬🇧',
  FR: '🇫🇷',
  DE: '🇩🇪',
  IT: '🇮🇹',
  AU: '🇦🇺',
  OTHER: '🌍',
};

export const RATING_COLORS: Record<string, string> = {
  must_go: '#B090D4',
  worth_it: '#6AC0D4',
  neutral: '#90C490',
  not_great: '#E8C070',
};

export const CATEGORY_EMOJIS: Record<string, string> = {
  cafe: '☕',
  restaurant: '🍽️',
  photospot: '📸',
  street: '🚶',
  bar: '🍸',
  culture: '🏛️',
  nature: '🌿',
  shopping: '🛍️',
};

export const NATIONALITY_CHIPS = [
  { code: 'KR', flag: '🇰🇷' },
  { code: 'JP', flag: '🇯🇵' },
  { code: 'US', flag: '🇺🇸' },
  { code: 'CN', flag: '🇨🇳' },
  { code: 'TW', flag: '🇹🇼' },
  { code: 'GB', flag: '🇬🇧' },
  { code: 'FR', flag: '🇫🇷' },
  { code: 'DE', flag: '🇩🇪' },
  { code: 'IT', flag: '🇮🇹' },
  { code: 'ES', flag: '🇪🇸' },
  { code: 'AU', flag: '🇦🇺' },
  { code: 'RU', flag: '🇷🇺' },
  { code: 'OTHER', flag: '🌍' },
];

export const CITY_CENTERS: Record<
  string,
  { lat: number; lng: number; zoom: number }
> = {
  seoul: { lat: 37.5665, lng: 126.978, zoom: 12 },
  busan: { lat: 35.1796, lng: 129.0756, zoom: 12 },
  jeju: { lat: 33.4996, lng: 126.5312, zoom: 11 },
  gyeongju: { lat: 35.8562, lng: 129.2247, zoom: 13 },
  jeonju: { lat: 35.8242, lng: 127.148, zoom: 13 },
  gangneung: { lat: 37.7519, lng: 128.876, zoom: 12 },
  sokcho: { lat: 38.2044, lng: 128.5912, zoom: 12 },
  yeosu: { lat: 34.7604, lng: 127.6622, zoom: 12 },
  incheon: { lat: 37.4563, lng: 126.7052, zoom: 12 },
};
