// Jest stub for react-router-dom.
//
// react-router v7 ships its core (`react-router`) as ESM-only, which CRA's
// Jest resolver cannot load. Production builds use webpack, which handles the
// ESM fine — only the Jest environment needs this shim. Mapped in via the
// `jest.moduleNameMapper` key in package.json.
//
// It also provides a minimal in-memory router (MemoryRouter, Link, useNavigate, Navigate,
// Routes/Route with exact-path matching) so tests can navigate.
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

const DEFAULT_LOCATION = { pathname: '/', search: '', hash: '', state: null, key: 'default' };
const LocationContext = React.createContext(DEFAULT_LOCATION);
const NavigationTypeContext = React.createContext('POP');

function parseTo(to) {
  const path = typeof to === 'string' ? to : (to && to.pathname) || '/';
  const [pathname, search = ''] = path.split('?');
  return { ...DEFAULT_LOCATION, pathname, search: search ? `?${search}` : '' };
}

const NavigateContext = React.createContext(null);

// In-memory router with a history stack: navigate(to, { state, replace })
// pushes or replaces, navigate(-1) pops. Location carries state and a key.
function MemoryRouter({ children, initialEntries }) {
  const keys = React.useRef(0);
  const [hist, setHist] = React.useState(() => ({
    entries: [parseTo(initialEntries && initialEntries[0])],
    index: 0,
    action: 'POP',
  }));
  const navigate = React.useCallback((to, opts = {}) => {
    setHist((h) => {
      if (typeof to === 'number') {
        const index = Math.max(0, Math.min(h.entries.length - 1, h.index + to));
        return { ...h, index, action: 'POP' };
      }
      keys.current += 1;
      const entry = { ...parseTo(to), state: opts.state ?? null, key: `k${keys.current}` };
      if (opts.replace) {
        const entries = h.entries.slice();
        entries[h.index] = entry;
        return { entries, index: h.index, action: 'REPLACE' };
      }
      const entries = [...h.entries.slice(0, h.index + 1), entry];
      return { entries, index: entries.length - 1, action: 'PUSH' };
    });
  }, []);
  return React.createElement(
    NavigateContext.Provider,
    { value: navigate },
    React.createElement(
      NavigationTypeContext.Provider,
      { value: hist.action },
      React.createElement(LocationContext.Provider, { value: hist.entries[hist.index] }, children)
    )
  );
}

// Renders a plain anchor with the real props; a plain click navigates.
function Link({ to, onClick, children, ...rest }) {
  const navigate = React.useContext(NavigateContext);
  const href = typeof to === 'string' ? to : (to && to.pathname) || '/';
  const handleClick = (e) => {
    if (onClick) onClick(e);
    if (!navigate || e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return React.createElement('a', { href, ...rest, onClick: handleClick }, children);
}

function useNavigate() {
  return React.useContext(NavigateContext) || (() => {});
}

// <Navigate to /> moves the in-memory location once, after mount.
function Navigate({ to }) {
  const navigate = useNavigate();
  React.useEffect(() => {
    navigate(to);
  }, [navigate, to]);
  return null;
}

function Route() {
  return null;
}

function Routes({ children }) {
  const { pathname } = React.useContext(LocationContext);
  const routes = React.Children.toArray(children).filter((c) => c && c.props);
  const match =
    routes.find((c) => c.props.path === pathname) || routes.find((c) => c.props.path === '*');
  return match ? match.props.element || null : null;
}

module.exports = {
  useSearchParams,
  MemoryRouter,
  BrowserRouter: passthrough,
  Link,
  Routes,
  Route,
  useNavigate,
  Navigate,
  useLocation: () => React.useContext(LocationContext),
  useNavigationType: () => React.useContext(NavigationTypeContext),
};
