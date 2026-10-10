// Chat nicknames for slots → the catalogue name they mean. Keys are matched
// after normalizeName (lowercase, no punctuation, no leading "the"). An alias
// whose target isn't in the catalogue is ignored, so a renamed slot never
// breaks the matcher. Add one when chat keeps using a nickname.
export const SLOT_ALIASES = {
  gates: 'Gates of Olympus',
  goo: 'Gates of Olympus',
  sugar: 'Sugar Rush',
  wanted: 'Wanted Dead or a Wild',
  bonanza: 'Sweet Bonanza',
  sb: 'Sweet Bonanza',
  sbx: 'Sweet Bonanza Xmas',
};
