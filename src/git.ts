import { spawn } from './spawn.js';

const IGNORED_FILES = ['.npmrc', 'CHANGELOG.md'];

const getBaseRefTag = async (): Promise<string | null> => {
  return await spawn('git', ['describe', '--abbrev=0', '--first-parent'])
    .assertSuccess()
    .text()
    .catch(() => null);
};

const getFileAtRef = async (ref: string, filename: string): Promise<string> => {
  const diff = await spawn('git', ['show', `${ref}:${filename}`])
    .assertSuccess()
    .text();

  return diff.replace(/^(.)(.*(?:\n\r?|$))/gmu, (_, prefix, suffix) =>
    prefix !== ' ' && prefix !== '-' ? '' : suffix,
  );
};

const isCommitted = async (): Promise<boolean> => {
  const uncommitted = (await spawn('git', ['status', '-s', '--porcelain']).assertSuccess().lines())
    .map((line) => line.replace(/^.{2} /, ''))
    .filter((filename) => !IGNORED_FILES.includes(filename));

  return uncommitted.length === 0;
};

const isPathModified = async (baseRef: string, path: string): Promise<boolean> => {
  const modified = (
    await spawn('git', ['diff', '--name-only', `${baseRef}..HEAD`, '--', path])
      .assertSuccess()
      .lines()
  ).filter((filename) => !IGNORED_FILES.includes(filename));

  return modified.length > 0;
};

const createTag = async (): Promise<void> => {
  const tagName = `release-${Date.now()}`;

  if (!(await spawn('git', ['config', 'user.name']).wait())) {
    await spawn('git', ['config', 'user.name', 'anglerci']).assertSuccess().wait();
  }

  await spawn('git', ['tag', '-a', tagName, '-m', 'Released by Angler CI.']).assertSuccess().wait();
  await spawn('git', ['push', '--no-verify', 'origin', `refs/tags/${tagName}`])
    .assertSuccess()
    .wait();
};

const fetch = async (ref?: string | null): Promise<void> => {
  if ((await spawn('git', ['fetch', '--unshallow']).wait()) && ref && (await spawn('git', ['checkout', ref]).wait())) {
    await spawn('git', ['checkout', '-']).assertSuccess().wait();
  }
};

export { createTag, fetch, getBaseRefTag, getFileAtRef, isCommitted, isPathModified };
