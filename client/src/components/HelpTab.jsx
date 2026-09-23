export default function HelpTab() {
  return (
    <div className="space-y-5 max-w-4xl">
      <div className="brutal-card bg-surface border-l-4 border-l-accent px-4 py-3">
        <h2 className="text-lg font-bold text-white uppercase tracking-tight">Help</h2>
        <p className="text-xs text-zinc-400 mt-1">
          Set up the credentials and S3 settings required by AWSManager.
        </p>
      </div>

      <section className="brutal-panel space-y-3">
        <h3 className="text-base font-bold text-white uppercase tracking-tight">Create an AWS Access Key</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-300 leading-relaxed">
          <li>
            Open the{' '}
            <a
              href="https://console.aws.amazon.com/iam/home#/security_credentials?section=IAM_credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline hover:text-white"
            >
              AWS IAM Dashboard
            </a>
          </li>
          <li>Locate the <strong className="text-white">Access keys</strong> section and select <strong className="text-white">Create access key</strong>.</li>
          <li>For <strong className="text-white">Use case</strong>, select <strong className="text-white">Application running outside AWS</strong>, then select <strong className="text-white">Next</strong>.</li>
          <li>Enter a <strong className="text-white">description</strong> that will allow you to identify the access key in the future.</li>
          <li>Select <strong className="text-white">Create access key</strong>.</li>
          <li>Copy the <strong className="text-white">Access key</strong> and <strong className="text-white">Secret access key</strong> and store them securely. The secret access key is only displayed when the access key is created, so ensure it is saved before leaving the page.</li>
        </ol>
      </section>

      <section className="brutal-panel space-y-3">
        <h3 className="text-base font-bold text-white uppercase tracking-tight">Create a Semaphore API Key</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-300 leading-relaxed">
          <li>From the Semaphore home page, select your name, then select <strong className="text-white">API Tokens</strong>.</li>
          <li>Select <strong className="text-white">New Token</strong>.</li>
          <li>In the <strong className="text-white">New Token</strong> window, enter a <strong className="text-white">Token Name</strong> that will allow you to identify the API token in the future.</li>
          <li>Choose when the token will <strong className="text-white">expire</strong>.</li>
          <li>Select <strong className="text-white">Create</strong>.</li>
          <li>Copy the new <strong className="text-white">API token</strong> and store it securely. The token is only displayed when it is created, so ensure it is saved before leaving the page.</li>
        </ol>
      </section>

      <section className="brutal-panel space-y-3">
        <h3 className="text-base font-bold text-white uppercase tracking-tight">Configure S3 Access</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-300 leading-relaxed">
          <li>If you have an S3 bucket that you want AWSManager to access, enter the bucket name in <strong className="text-white">S3 BUCKET NAME</strong>.</li>
          <li>Select the AWS region in which the bucket is located using <strong className="text-white">S3 REGION</strong>.</li>
          <li>Enter the <strong className="text-white">PRESIGNED URL EXPIRY</strong> in minutes. This determines how long generated presigned URLs remain valid.</li>
        </ol>
      </section>
    </div>
  );
}
