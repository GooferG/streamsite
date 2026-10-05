import { useLocation } from 'react-router-dom';

// The nav bar's height. The side sheet and the control room's geometry sit
// under it, and pages pad their tops for it (pt-20).
export const NAV_H = 57;

// The bar's height on a route: the home page drops the bar (a corner menu
// button instead), so the room runs full height there.
export const navHeightFor = (pathname) => (pathname === '/' ? 0 : NAV_H);
export const useNavHeight = () => navHeightFor(useLocation().pathname);
