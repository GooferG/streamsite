// Place badges shared by the winners panel and the prediction board.
const PLACE_LABEL = { 1: '1ST', 2: '2ND', 3: '3RD' };
const PLACE_TONE = {
  1: 'text-orange-admin border-orange-admin/60 bg-orange-admin/10',
  2: 'text-white-body border-white/45 bg-white/5',
  3: 'text-emerald-signal border-emerald-signal/50 bg-emerald-signal/5',
};

export function placeLabel(place) {
  return PLACE_LABEL[place] || `${place}TH`;
}

export function placeTone(place) {
  return PLACE_TONE[place] || PLACE_TONE[1];
}
