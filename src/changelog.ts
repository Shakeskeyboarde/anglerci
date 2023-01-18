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
    `(?:^|\\n\\r?)(#+)[\\t ]*(?:v(?:ersion:?[\t ]+)?)?${versionPattern}(?=\\n\\r?)(?<content>[\\s\\S]*?)(?=\\n\\r?\\1(?!#)|$)`,
    'iu',
  );

  const section = text.match(sectionRx)?.groups?.content?.trim();

  if (!section) {
    return 'missing';
  }

  return /^#+.*\b(?:breaking|major)\b/imu.test(section)
    ? 'major'
    : /^#+.*\b(?:features?|enhancements?|minor)\b/imu.test(section)
    ? 'minor'
    : 'patch';
};

export { getChangeLogDiff };
