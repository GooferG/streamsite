// Mechanical checks for DESIGN.md §7 (On Air). Each rule here is one the
// ui-finish-gate review caught breaking; the scan keeps them from creeping back.
const fs = require('fs');
const path = require('path');
const config = require('../../../../tailwind.config.js');

const ROOT = path.resolve(__dirname, '../../../..');
const DIRS = ['src/components/onAir', 'src/components/hunts', 'src/components/store', 'src/components/nav', 'src/components/gamba'];
// Nav chrome that lives outside the nav folder, scanned with the nav (the Gamba tuner is chrome too).
const CONTROL_ROOM_BUTTON = 'src/components/controlRoom/ControlRoomButton.js';
const FILES = [CONTROL_ROOM_BUTTON];
// Fixture data and the per-slot tile tints are the recorded raw-colour exceptions.
const RAW_COLOUR_EXEMPT = ['src/components/hunts/huntFixtures.js', 'src/components/store/storeFixtures.js'];

const read = (rel) => [rel, fs.readFileSync(path.join(ROOT, rel), 'utf8')];

function sources() {
  return [
    ...DIRS.flatMap((dir) =>
      fs
        .readdirSync(path.join(ROOT, dir))
        .filter((f) => f.endsWith('.js'))
        .map((f) => read(`${dir}/${f}`))
    ),
    ...FILES.map(read),
  ];
}

const isNavChrome = (rel) =>
  rel.startsWith('src/components/nav/') || rel.startsWith('src/components/gamba/') || rel === CONTROL_ROOM_BUTTON;

function offenders(pattern, { only = () => true } = {}) {
  return sources()
    .filter(([rel]) => only(rel))
    .flatMap(([rel, src]) =>
      src
        .split('\n')
        .map((line, i) => [rel, i + 1, line])
        .filter(([, , line]) => pattern.test(line) && !line.includes('contract-exempt'))
        .map(([file, n, line]) => `${file}:${n}: ${line.trim()}`)
    );
}

function luminance(hex) {
  const [r, g, b] = hex
    .replace('#', '')
    .match(/../g)
    .map((h) => parseInt(h, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const { onair } = config.theme.extend.colors;

test('Readable Labels: the screen label ink is at least as light as ink-5', () => {
  expect(luminance(onair.screen.dim)).toBeGreaterThanOrEqual(luminance(onair.ink[5]));
});

test('Readable Labels: disabled and placeholder text stay at or above ink-5', () => {
  expect(offenders(/disabled:text-onair-ink-[67]|placeholder:text-[^\s'"`]*\/50/)).toEqual([]);
});

test('Type: nothing below the 10px floor, no unloaded 600 weight, mono tracking from 0.15em', () => {
  expect(offenders(/text-\[0\.5625rem\]|font-semibold|tracking-\[0\.1[0-4]em\]/)).toEqual([]);
});

test('Tokens: no raw colours or bare radii in the Hunts, Store, nav and Gamba components', () => {
  expect(
    offenders(/rgba\(|#[0-9a-fA-F]{6}\b|\brounded\b(?!-)/, {
      only: (rel) =>
        (rel.startsWith('src/components/hunts/') || rel.startsWith('src/components/store/') || isNavChrome(rel)) &&
        !RAW_COLOUR_EXEMPT.includes(rel),
    })
  ).toEqual([]);
});

test('Scope: the control room button is scanned as nav chrome', () => {
  expect(sources().map(([rel]) => rel)).toContain(CONTROL_ROOM_BUTTON);
});

test('Type: every mono label in the nav and Gamba chrome sets its tracking (0.15em or more) on the same line', () => {
  expect(offenders(/\$\{MONO\}(?!.*tracking-\[)/, { only: isNavChrome })).toEqual([]);
});

// The shared monitor screen (the Hunts monitor and the Gamba featured monitor) is held to it too.
const MONITOR_STAGE = 'src/components/hunts/MonitorStage.js';

test('Type: the nav and Gamba chrome and the monitor screen stay on the §7 scale (no text-base or text-lg)', () => {
  expect(offenders(/\btext-(base|lg)\b/, { only: (rel) => isNavChrome(rel) || rel === MONITOR_STAGE })).toEqual([]);
});

test('Roles: orange stays off the open slip', () => {
  const slip = sources().find(([rel]) => rel.endsWith('HuntSlip.js'))[1];
  const orange = slip.split('\n').filter((l) => /text-onair-winner/.test(l));
  // Only the settled "Actual" figure (the result) may be orange.
  expect(orange).toHaveLength(1);
  expect(orange[0]).toMatch(/text-onair-winner-light/);
});

test('Glow Means Something: data dots never use decoration-only ink-7', () => {
  expect(offenders(/bg-onair-ink-7/, { only: (rel) => rel.endsWith('HuntMeter.js') })).toEqual([]);
});

test('Tokens: the nav bar shadow is a boxShadow token, not a radius', () => {
  expect(config.theme.extend.boxShadow['onair-bar']).toBe('inset 0 1px 0 rgba(255,255,255,.09), inset 0 -2px 0 rgba(0,0,0,.6)');
  expect(config.theme.extend.borderRadius['onair-bar']).toBeUndefined();
});

test('Roles: the nav and Gamba chrome carry no orange (inside On Air orange is the winner)', () => {
  expect(offenders(/orange|onair-winner/, { only: isNavChrome })).toEqual([]);
});
