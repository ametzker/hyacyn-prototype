export const looks = {
  look3: {
    id: '03',
    title: 'LOOK 03',
    collection: 'REF 11211',
    index: '03/22',
    model: 'look3',
    garments: ['LEATHER VEST', 'SHORTS', 'SOCKS', 'SHOES'],
    info: 'HYACYN REF 11211\nRTW S/S 27 - PARIS - JUNE 2026\nDIGITAL RECONSTRUCTION OF RUNWAY LOOK.'
  },
  look11: {
    id: '11',
    title: 'LOOK 11',
    collection: 'REF 11211',
    index: '11/22',
    model: 'look11',
    garments: ['RED COAT', 'TROUSERS', 'SHOES', 'ACCESSORIES'],
    info: 'HYACYN REF 11211\nRTW S/S 27 - PARIS - JUNE 2026\nDIGITAL RECONSTRUCTION OF RUNWAY LOOK.'
  }
};

export function lookKeyFromHash(hash = window.location.hash) {
  const normalized = hash.replace('#', '').toLowerCase();

  if (normalized === 'look03' || normalized === 'look3') {
    return 'look3';
  }

  if (normalized === 'look11') {
    return 'look11';
  }

  return null;
}

export function hashFromLookKey(key) {
  const look = looks[key];
  return look ? `#look${look.id}` : '';
}
