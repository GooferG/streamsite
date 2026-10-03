// Mechanical checks for DESIGN.md §7 (On Air). Each rule here is one the
// ui-finish-gate review caught breaking; the scan keeps them from creeping back.
const fs = require('fs');
const path = require('path');
const config = require('../../../../tailwind.config.js');

const ROOT = path.resolve(__dirname, '../../../..');
const DIRS = ['src/components/onAir', 'src/components/hunts', 'src/components/store'];
// Fixture data and the per-slot tile tints are the recorded raw-colour exceptions.
const RAW_COLOUR_EXEMPT = ['src/components/hunts/huntFixtures.js', 'src/components/store/storeFixtures.js'];

function sources() {
  return DIRS.flatMap((dir) =>
    fs
      .readdirSync(path.join(ROOT, dir))
      .filter((f) => f.endsWith('.js'))
      .map((f) => {
        const rel = `${dir}/${f}`;
        return [rel, fs.readFileSync(path.join(ROOT, rel), 'utf8')];
      })
  );
}

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

test('Tokens: no raw colours or bare radii in the Hunts and Store components', () => {
  expect(
    offenders(/rgba\(|#[0-9a-fA-F]{6}\b|\brounded\b(?!-)/, {
      only: (rel) =>
        (rel.startsWith('src/components/hunts/') || rel.startsWith('src/components/store/')) &&
        !RAW_COLOUR_EXEMPT.includes(rel),
    })
  ).toEqual([]);
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
