import { StandaloneBuild } from '@expo/xdl';
import { Platform } from '@expo/config';
import ora from 'ora';

import { UploadType, uploadAsync } from '../../../uploads';
import { existingFile } from '../../../validators';

enum ArchiveSourceType {
  url,
  latest,
  path,
  buildId,
}

interface ArchiveSourceBase {
  sourceType: ArchiveSourceType;
}

interface ArchiveUrlSource extends ArchiveSourceBase {
  sourceType: ArchiveSourceType.url;
  url: string;
}

interface ArchiveLatestSource extends ArchiveSourceBase {
  sourceType: ArchiveSourceType.latest;
  platform: Platform;
  owner?: string;
  slug: string;
}

interface ArchivePathSource extends ArchiveSourceBase {
  sourceType: ArchiveSourceType.path;
  path: string;
}

interface ArchiveBuildIdSource extends ArchiveSourceBase {
  sourceType: ArchiveSourceType.buildId;
  platform: Platform;
  id: string;
  owner?: string;
  slug: string;
}

export type ArchiveSource =
  | ArchiveUrlSource
  | ArchiveLatestSource
  | ArchivePathSource
  | ArchiveBuildIdSource;

async function getArchiveUrlAsync(source: ArchiveSource) {
  if (source.sourceType === ArchiveSourceType.url) {
    return source.url;
  } else if (source.sourceType === ArchiveSourceType.latest) {
    const builds = await StandaloneBuild.getStandaloneBuilds(
      {
        platform: source.platform,
        owner: source.owner,
        slug: source.slug,
      },
      1
    );
    if (builds.length === 0) {
      throw new Error("Couldn't find any builds for this project.");
    }
    return builds[0].artifacts.url;
  } else if (source.sourceType === ArchiveSourceType.path) {
    if (!(await existingFile(source.path))) {
      throw new Error(`${source.path} doesn't exist`);
    }
    const spinner = ora(`Uploading ${source.path}`).start();
    try {
      const archiveUrl = await uploadAsync(UploadType.SUBMISSION_APP_ARCHIVE, source.path);
      spinner.succeed();
      return archiveUrl;
    } catch (err) {
      spinner.fail();
      throw err;
    }
  } else if (source.sourceType === ArchiveSourceType.buildId) {
    const build = await StandaloneBuild.getStandaloneBuildById({
      platform: source.platform,
      id: source.id,
      owner: source.owner,
      slug: source.slug,
    });
    if (!build) {
      throw new Error(`Couldn't find build with id: ${source.id}`);
    }
    return build.artifacts.url;
  } else {
    throw new Error('This should never happen');
  }
}

export { ArchiveSourceType, getArchiveUrlAsync };
