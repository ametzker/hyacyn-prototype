export const looks = {
  look3: {
    id: '03',
    title: 'LOOK 03',
    collection: 'RTW 25/26',
    index: '03 / 37',
    model: 'look3',
    garments: ['LEATHER VEST', 'SHORTS', 'SOCKS', 'SHOES'],
    info: 'HYACYN RTW 25/26\nPARIS - MARCH 2025\nDIGITAL RECONSTRUCTION OF RUNWAY LOOK.'
  },
  look11: {
    id: '11',
    title: 'LOOK 11',
    collection: 'RTW 25/26',
    index: '11 / 37',
    model: 'look11',
    garments: ['RED COAT', 'TROUSERS', 'SHOES', 'ACCESSORIES'],
    info: 'HYACYN RTW 25/26\nPARIS - MARCH 2025\nDIGITAL RECONSTRUCTION OF RUNWAY LOOK.'
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
