// Jest stub for react-router-dom.
//
// react-router v7 ships its core (`react-router`) as ESM-only, which CRA's
// Jest resolver cannot load. Production builds use webpack, which handles the
// ESM fine — only the Jest environment needs this shim. Mapped in via the
// `jest.moduleNameMapper` key in package.json.
//
// It also provides a minimal in-memory router (MemoryRouter, Link, useNavigate,
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

const DEFAULT_LOCATION = { pathname: '/', search: '', hash: '', state: null };
const LocationContext = React.createContext(DEFAULT_LOCATION);

function parseTo(to) {
  const path = typeof to === 'string' ? to : (to && to.pathname) || '/';
  const [pathname, search = ''] = path.split('?');
  return { ...DEFAULT_LOCATION, pathname, search: search ? `?${search}` : '' };
}

const NavigateContext = React.createContext(null);

// In-memory router: location lives in state, seeded from `initialEntries[0]`.
function MemoryRouter({ children, initialEntries }) {
  const [location, setLocation] = React.useState(() => parseTo(initialEntries && initialEntries[0]));
  const navigate = React.useCallback((to) => {
    if (typeof to === 'number') return;
    setLocation(parseTo(to));
  }, []);
  return React.createElement(
    NavigateContext.Provider,
    { value: navigate },
    React.createElement(LocationContext.Provider, { value: location }, children),
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
  useLocation: () => React.useContext(LocationContext),
};
