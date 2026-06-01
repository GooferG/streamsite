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

module.exports = {
  useSearchParams,
  MemoryRouter: passthrough,
  BrowserRouter: passthrough,
  Link: ({ children }) => React.createElement('a', null, children),
  useNavigate: () => () => {},
  useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
};
