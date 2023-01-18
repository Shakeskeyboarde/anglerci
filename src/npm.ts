import * as semver from 'semver';

import * as git from './git.js';
import { spawn } from './spawn.js';

type Workspace = {
  readonly name: string;
  readonly version: semver.SemVer;
  readonly location: string;
  readonly modified: boolean;
  readonly published: boolean;
  readonly dependencies: Record<string, string>;
  readonly optionalDependencies: Record<string, string>;
  readonly peerDependencies: Record<string, string>;
};

const getPrefix = async (): Promise<string> => {
  return spawn('npm', ['prefix']).assertSuccess().text();
};

const getWorkspaces = async (baseRef: string | null): Promise<Map<string, Workspace>> => {
  const all: {
    name: string;
    version: string;
    location: string;
    private?: boolean;
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  }[] = [
    // Workspaces
    ...(await spawn('npm', ['query', '.workspace']).assertSuccess().json()),
    // Root
    { ...(await spawn('npm', ['pkg', 'get']).assertSuccess().json()), location: '.' },
  ].filter((workspace) => workspace.name && workspace.version && !workspace.private);

  const names = new Set(all.map((workspace) => workspace.name));
  const unsorted: Workspace[] = [];
  const sorted = new Map<string, Workspace>();

  for (const {
    location,
    name,
    version: rawVersion,
    dependencies = {},
    optionalDependencies = {},
    peerDependencies = {},
  } of all) {
    const modified = baseRef ? await git.isPathModified(baseRef, location) : true;
    const version = semver.parse(rawVersion);

    if (!version) {
      throw new Error(`Workspace "${name}" version is invalid (${rawVersion})`);
    }

    const published = await isPublished(name, version);

    unsorted.push({
      location,
      name,
      version,
      modified,
      published,
      dependencies: Object.entries(dependencies).reduce<Record<string, string>>((result, [key, value]) => {
        return names.has(key) ? { ...result, [key]: value } : result;
      }, {}),
      optionalDependencies: Object.entries(optionalDependencies).reduce<Record<string, string>>(
        (result, [key, value]) => {
          return names.has(key) ? { ...result, [key]: value } : result;
        },
        {},
      ),
      peerDependencies: Object.entries(peerDependencies).reduce<Record<string, string>>((result, [key, value]) => {
        return names.has(key) ? { ...result, [key]: value } : result;
      }, {}),
    });
  }

  while (unsorted.length) {
    const i = unsorted.findIndex(({ dependencies, optionalDependencies, peerDependencies }) => {
      return [
        ...Object.keys(dependencies),
        ...Object.keys(optionalDependencies),
        ...Object.keys(peerDependencies),
      ].every((name) => sorted.has(name));
    });

    if (i < 0) {
      throw new Error(`Dependency cycle detected (${[...unsorted.map((workspace) => workspace.name)].join(', ')})`);
    }

    const workspace = unsorted.splice(i, 1)[0] as Workspace;

    sorted.set(workspace.name, workspace);
  }

  return sorted;
};

const getVersionDiff = async (
  baseRef: string,
  location: string,
  current: semver.SemVer,
): Promise<semver.ReleaseType | null> => {
  const previousVersion =
    semver.parse(
      await git
        .getFileAtRef(baseRef, `${location}/package.json`)
        .then((text) => JSON.parse(text).version ?? '')
        .catch(() => ''),
    ) ?? new semver.SemVer('0.0.0');

  if (semver.lte(current, previousVersion)) {
    return null;
  }

  switch (semver.diff(current, previousVersion)) {
    case 'major':
    case 'premajor':
      return 'major';
    case 'minor':
    case 'preminor':
      return 'minor';
    default:
      return 'patch';
  }
};

const isPublished = async (name: string, version: semver.SemVer): Promise<boolean> => {
  return await spawn('npm', ['view', `${name}@${version}`, 'name']).success();
};

const publish = async (location: string): Promise<void> => {
  await spawn('npm', ['--verbose', '-w', `./${location}`, 'publish'])
    .assertSuccess()
    .wait();
};

export { type Workspace, getPrefix, getVersionDiff, getWorkspaces, isPublished, publish };
