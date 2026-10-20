import path from 'node:path';

interface InstalledPackage {
  version: string;
  peerDependencies?: Record<string, string>;
}

/** Check peer relationships between packages explicitly installed by this repo.
 * Bun resolves transitive and absent optional peers; this gate catches a root
 * dependency update that contradicts another direct package's peer contract.
 */
export function directPeerConflicts(
  installed: Record<string, InstalledPackage>,
) {
  const conflicts: string[] = [];
  for (const [name, pkg] of Object.entries(installed)) {
    for (const [peer, range] of Object.entries(pkg.peerDependencies || {})) {
      const provided = installed[peer];
      if (provided && !Bun.semver.satisfies(provided.version, range)) {
        conflicts.push(
          `${name}@${pkg.version} requires ${peer}@${range}; installed ${provided.version}`,
        );
      }
    }
  }
  return conflicts.sort();
}

export async function checkDirectPeers(root: string) {
  const pkg = await Bun.file(path.join(root, 'package.json')).json();
  const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  const entries = await Promise.all(
    names.map(
      async (name) =>
        [
          name,
          await Bun.file(
            path.join(root, 'node_modules', name, 'package.json'),
          ).json(),
        ] as const,
    ),
  );
  const conflicts = directPeerConflicts(Object.fromEntries(entries));
  if (conflicts.length)
    throw new Error(
      `Incompatible direct dependency peers:\n${conflicts.join('\n')}`,
    );
}
