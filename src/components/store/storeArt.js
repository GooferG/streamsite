// Generated GSN art (scripts/gsn-art). Lives in public/gsn/, never
// public/store/ (a folder there would shadow the /store route).
export const OPERATOR = {
  standby: '/gsn/operator-standby.webp',
  call: '/gsn/operator-call.webp',
  shrug: '/gsn/operator-shrug.webp',
};
export const IDENT = '/gsn/ident.webp';

let preloaded = false;

// Called on the first hold so the operator never pops in late.
export function preloadOperator() {
  if (preloaded || typeof Image === 'undefined') return;
  preloaded = true;
  Object.values(OPERATOR).forEach((src) => {
    const img = new Image();
    img.src = src;
  });
}
