import fs from 'node:fs/promises';

import type * as semver from 'semver';

const getChangeLogDiff = async (
  location: string,
  version: semver.SemVer,
): Promise<semver.ReleaseType | 'missing' | null> => {
  const text = await fs.readFile(`${location}/CHANGELOG.md`, { encoding: 'utf8' }).catch((err) => {
    if (err?.code === 'ENOENT') {
      return null;
    }

    throw err;
  });

  if (text == null) {
    return null;
  }

  const versionPattern = version
    .toString()
    .replace(/[|\\{}()[\]^$+*?.]/gu, '\\$&')
    .replace(/-/gu, '\\x2d');

  const sectionRx = new RegExp(
    `(?:^|\\n\\r?)(#+)[\\t ]*v?${versionPattern}(?=\\n\\r?)(?<content>[\\s\\S]*?)(?=\\n\\r?\\1(?!#)|$)`,
    'u',
  );

  const section = text.match(sectionRx)?.groups?.content?.trim();

  if (!section) {
    return 'missing';
  }

  return /^#+[\t ]*breaking[\t ]*changes?[\t ]*$/imu.test(section)
    ? 'major'
    : /^#+[\t ]*features?[\t ]*$/imu.test(section)
    ? 'minor'
    : 'patch';
};

export { getChangeLogDiff };
