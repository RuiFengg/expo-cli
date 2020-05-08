import attempt from 'lodash/attempt';
import isError from 'lodash/isError';
import pick from 'lodash/pick';
import ora from 'ora';
import axios from 'axios';

import log from '../../../../log';
import { AndroidSubmissionConfig } from './AndroidSubmissionConfig';
import { ServiceAccountSource, getServiceAccountAsync } from './ServiceAccountSource';
import { ArchiveSource, getArchiveUrlAsync } from '../ArchiveSource';
import SubmissionService, { Platform, Submission, SubmissionStatus } from '../SubmissionService';
import { AndroidPackageSource, getAndroidPackageAsync } from './AndroidPackageSource';

export interface AndroidSubmissionOptions
  extends Pick<AndroidSubmissionConfig, 'archiveType' | 'track' | 'releaseStatus'> {
  androidPackage: AndroidPackageSource;
  archiveSource: ArchiveSource;
  serviceAccountSource: ServiceAccountSource;
}

class AndroidSubmitter {
  constructor(private options: AndroidSubmissionOptions) {}

  async submit() {
    const submissionConfig = await this.formatSubmissionConfig();
    const scheduleSpinner = ora('Scheduling submission').start();
    const submissionId = await SubmissionService.startSubmissionAsync(
      Platform.ANDROID,
      submissionConfig
    );
    scheduleSpinner.succeed();
    let submissionCompleted = false;
    let submission: Submission | null = null;
    const submissionSpinner = ora('Submitting your app to Google App Store').start();
    while (!submissionCompleted) {
      submission = await SubmissionService.getSubmissionAsync(submissionId);
      submissionSpinner.text = getStatusText(submission.status);
      if (submission.status === SubmissionStatus.ERRORED) {
        submissionCompleted = true;
        submissionSpinner.fail();
      } else if (submission.status === SubmissionStatus.FINISHED) {
        submissionCompleted = true;
        submissionSpinner.succeed();
      }
    }
    await displayLogs(submission);
  }

  private async formatSubmissionConfig(): Promise<AndroidSubmissionConfig> {
    const androidPackage = await getAndroidPackageAsync(this.options.androidPackage);
    const archiveUrl = await getArchiveUrlAsync(this.options.archiveSource);
    const serviceAccount = await getServiceAccountAsync(this.options.serviceAccountSource);
    return {
      androidPackage,
      archiveUrl,
      serviceAccount,
      ...pick(this.options, 'archiveType', 'track', 'releaseStatus'),
    };
  }
}

const getStatusText = (status: SubmissionStatus): string => {
  if (status === SubmissionStatus.IN_QUEUE) {
    return 'Submitting your app to Google App Store: waiting for an available submitter';
  } else if (status === SubmissionStatus.IN_PROGRESS) {
    return 'Submitting your app to Google App Store: submission in progress';
  } else if (status === SubmissionStatus.FINISHED) {
    return 'Successfully submitted your app to Google App Store!';
  } else if (status === SubmissionStatus.ERRORED) {
    return 'Something went wrong when submitting your app to Google App Store. See logs below.';
  } else {
    throw new Error('This should never happen');
  }
};

async function displayLogs(submission: Submission | null): Promise<void> {
  if (!submission?.submissionInfo?.logsUrl) {
    // no logs available, nothing to display
    return;
  }
  const rawLogs = await downloadFile(submission?.submissionInfo?.logsUrl);
  const logs = parseLogs(rawLogs);
  for (const { level, msg } of logs) {
    if (level === 'error') {
      log.error(msg);
    } else if (level === 'warn') {
      log.warn(msg);
    } else {
      log(msg);
    }
  }
}

async function downloadFile(url: string): Promise<string> {
  const { data } = await axios.get(url);
  return data;
}

interface Log {
  level: 'error' | 'warn' | 'info';
  msg: string;
}

function parseLogs(logs: string): Log[] {
  const lines = logs.split('\n');
  const result: Log[] = [];
  for (const line of lines) {
    const parsedLine = attempt(() => JSON.parse(line));
    if (isError(parsedLine)) {
      continue;
    }
    let level: Log['level'];
    const { level: levelNumber, msg } = parsedLine;
    if (levelNumber >= 50) {
      level = 'error';
    } else if (levelNumber >= 40) {
      level = 'warn';
    } else {
      level = 'info';
    }
    result.push({ level, msg });
  }
  return result;
}

export default AndroidSubmitter;
