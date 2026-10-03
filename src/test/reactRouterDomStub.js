// Jest stub for react-router-dom.
//
// react-router v7 ships its core (`react-router`) as ESM-only, which CRA's
// Jest resolver cannot load. Production builds use webpack, which handles the
// ESM fine — only the Jest environment needs this shim. Mapped in via the
// `jest.moduleNameMapper` key in package.json.
//
// Tests that need to control router behavior should `jest.mock('react-router-dom')`
// with their own factory; this stub is the safe default so importing the module
// never drags in the ESM core.

const React = require('react');

function useSearchParams() {
  const params = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : '',
  );
  const setParams = () => {};
  return [params, setParams];
}

function passthrough({ children }) {
  return React.createElement(React.Fragment, null, children);
}

const DEFAULT_LOCATION = { pathname: '/', search: '', hash: '', state: null };
const LocationContext = React.createContext(DEFAULT_LOCATION);

// Static location from `initialEntries[0]` (no navigation); enough for
// components that only read the pathname or render links.
function MemoryRouter({ children, initialEntries }) {
  const entry = initialEntries && initialEntries[0];
  const path = typeof entry === 'string' ? entry : (entry && entry.pathname) || '/';
  const [pathname, search = ''] = path.split('?');
  const location = { ...DEFAULT_LOCATION, pathname, search: search ? `?${search}` : '' };
  return React.createElement(LocationContext.Provider, { value: location }, children);
}

// Renders a plain anchor with the real props (href, className, aria-*).
function Link({ to, children, ...rest }) {
  const href = typeof to === 'string' ? to : (to && to.pathname) || '/';
  return React.createElement('a', { href, ...rest }, children);
}

module.exports = {
  useSearchParams,
  MemoryRouter,
  BrowserRouter: passthrough,
  Link,
  useNavigate: () => () => {},
  useLocation: () => React.useContext(LocationContext),
};
