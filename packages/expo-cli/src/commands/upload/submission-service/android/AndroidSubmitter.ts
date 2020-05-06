import pick from 'lodash/pick';

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
    const submissionId = await SubmissionService.startSubmissionAsync(
      Platform.ANDROID,
      submissionConfig
    );
    let submissionCompleted = false;
    let submission: Submission;
    while (!submissionCompleted) {
      submission = await SubmissionService.getSubmissionAsync(submissionId);
      console.log(submission.status);
      submissionCompleted =
        submission.status === SubmissionStatus.ERRORED ||
        submission.status === SubmissionStatus.FINISHED;
    }
    console.log('completed!');
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

export default AndroidSubmitter;
