import S3 from '@expo/s3';
import { ApiV2, UserManager } from '@expo/xdl';
import md5File from 'md5-file/promise';
import fs from 'fs-extra';

enum UploadType {
  TURTLE_PROJECT_SOURCES = 'turtle-project-sources',
  SUBMISSION_APP_ARCHIVE = 'submission-app-archive',
}

async function uploadAsync(uploadType: UploadType, filePath: string): Promise<string> {
  const presignedPost = await generateS3PresignedPostAsync(uploadType, filePath);
  return await S3.uploadWithPresignedURL(presignedPost, fs.createReadStream(filePath));
}

async function generateS3PresignedPostAsync(
  uploadType: UploadType,
  filePath: string
): Promise<S3.PresignedPost> {
  const fileHash = await md5File(filePath);
  const api = await getApiClientForUser();
  const { presignedUrl } = await api.postAsync('upload-sessions', {
    type: uploadType,
    checksum: fileHash,
  });
  return presignedUrl;
}

async function getApiClientForUser(): Promise<ApiV2> {
  const user = await UserManager.ensureLoggedInAsync();
  return ApiV2.clientForUser(user);
}

export { uploadAsync, UploadType };
