import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { directPeerConflicts } from '../scripts/check-peers';

test('rejects a system-only MUI major update while the installed pickers require v7', () => {
  const conflicts = directPeerConflicts({
    '@mui/system': { version: '9.5.0' },
    '@mui/x-date-pickers': {
      version: '8.29.5',
      peerDependencies: {
        '@mui/system': '^5.15.14 || ^6.0.0 || ^7.0.0',
      },
    },
  });
  assert.equal(conflicts.length, 1);
  assert.match(conflicts[0], /x-date-pickers@8\.29\.5 requires @mui\/system/);
});

test('accepts picker v9 with its supported Material UI v7 peers', () => {
  assert.deepEqual(
    directPeerConflicts({
      '@mui/material': { version: '7.3.11' },
      '@mui/system': { version: '7.3.11' },
      '@mui/x-date-pickers': {
        version: '9.15.0',
        peerDependencies: {
          '@mui/material': '^7.3.0 || ^9.0.0',
          '@mui/system': '^7.3.0 || ^9.0.0',
        },
      },
    }),
    [],
  );
});

test('does not require optional peers that are not installed directly', () => {
  assert.deepEqual(
    directPeerConflicts({
      '@mui/x-date-pickers': {
        version: '9.15.0',
        peerDependencies: { dayjs: '^1.10.7' },
      },
    }),
    [],
  );
});
