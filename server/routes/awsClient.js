import { AsyncLocalStorage } from 'async_hooks';
import { EC2Client } from '@aws-sdk/client-ec2';

// Per-request AWS credentials, propagated across async/await via AsyncLocalStorage
// so route handlers can keep calling getClient(region) unchanged.
const store = new AsyncLocalStorage();

// Express middleware: capture browser-supplied AWS credentials for this request.
export function awsCredsMiddleware(req, _res, next) {
  const accessKeyId = req.get('x-aws-access-key-id');
  const secretAccessKey = req.get('x-aws-secret-access-key');
  const sessionToken = req.get('x-aws-session-token') || undefined;
  const creds = accessKeyId && secretAccessKey
    ? { accessKeyId, secretAccessKey, sessionToken }
    : undefined;
  store.run({ creds }, () => next());
}

// Build an EC2 client for a region using the request credentials when present,
// otherwise falling back to the default AWS credential chain (env / ~/.aws).
export function makeEC2Client(region) {
  const creds = store.getStore()?.creds;
  return new EC2Client(creds ? { region, credentials: creds } : { region });
}
