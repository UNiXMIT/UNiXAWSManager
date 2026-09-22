import { useConfig } from '../context/ConfigContext';
import SemTokenField from './SemTokenField';
import AwsCredsField from './AwsCredsField';
import S3SettingsField from './S3SettingsField';

// Central place to manage the credentials the app needs: the Semaphore API
// token and the AWS access key / secret. Both are stored per-browser.
export default function SettingsTab() {
  const { semToken, hasAwsCreds, s3Bucket } = useConfig();

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="brutal-card bg-surface border-l-4 border-l-accent px-4 py-3">
        <h2 className="text-lg font-bold text-white uppercase tracking-tight">Credentials</h2>
        <p className="text-xs text-zinc-400 mt-1">
          Stored only in this browser and sent with each request. Clear them by emptying the fields and saving.
        </p>
      </div>

      <div className="brutal-panel space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-tight">AWS</h3>
          <span className={`brutal-badge border-black ${hasAwsCreds ? 'bg-green-400 text-black' : 'bg-red-400 text-black'}`}>
            {hasAwsCreds ? 'Set' : 'Not set'}
          </span>
        </div>
        <AwsCredsField />
        <p className="text-xs text-zinc-500">
          Required for all AWS EC2 and Security Group operations.
        </p>
      </div>

      <div className="brutal-panel space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-tight">Semaphore</h3>
          <span className={`brutal-badge border-black ${semToken ? 'bg-green-400 text-black' : 'bg-red-400 text-black'}`}>
            {semToken ? 'Set' : 'Not set'}
          </span>
        </div>
        <SemTokenField />
        <p className="text-xs text-zinc-500">
          Required for all Semaphore operations.
        </p>
      </div>

      <div className="brutal-panel space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-tight">S3</h3>
          <span className={`brutal-badge border-black ${s3Bucket ? 'bg-green-400 text-black' : 'bg-red-400 text-black'}`}>
            {s3Bucket ? 'Set' : 'Not set'}
          </span>
        </div>
        <S3SettingsField />
        <p className="text-xs text-zinc-500">
          Bucket browsed by the S3 tab, and how long generated presigned URLs stay valid.
        </p>
      </div>
    </div>
  );
}
