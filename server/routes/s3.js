import { Router } from 'express';
import { ListObjectsV2Command, GetObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { awsCredsMiddleware, makeS3Client } from './awsClient.js';

const router = Router();
const DEFAULT_REGION = process.env.S3_REGION || process.env.DEFAULT_REGION || 'eu-west-2';
const MAX_KEYS = 1000;
// SigV4 caps presigned URL lifetime at 7 days.
const MAX_EXPIRY_SECONDS = 604800;
const MIN_EXPIRY_SECONDS = 60;
const BUCKET_RE = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

router.use(awsCredsMiddleware);

const getClient = (region) => makeS3Client(region && region !== 'all' ? region : DEFAULT_REGION);

function validateBucket(bucket) {
  if (!bucket) return 'Bucket name is required. Set one in Settings.';
  if (!BUCKET_RE.test(bucket)) return 'Invalid S3 bucket name.';
  return null;
}

function clampExpiry(value) {
  const seconds = Number.parseInt(value, 10);
  if (!Number.isFinite(seconds)) return Number(process.env.S3_PRESIGN_EXPIRY) || 3600;
  return Math.min(Math.max(seconds, MIN_EXPIRY_SECONDS), MAX_EXPIRY_SECONDS);
}

// List one "folder" level of a bucket: common prefixes plus the objects directly under `prefix`.
router.get('/objects', async (req, res) => {
  const { bucket, prefix = '', region, token } = req.query;
  const error = validateBucket(bucket);
  if (error) return res.status(400).json({ error });

  try {
    const data = await getClient(region).send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix || undefined,
      Delimiter: '/',
      MaxKeys: MAX_KEYS,
      ContinuationToken: token || undefined,
    }));

    res.json({
      prefix,
      folders: (data.CommonPrefixes || []).map(p => p.Prefix).filter(Boolean),
      objects: (data.Contents || [])
        // S3 returns the prefix itself as a zero-byte object when a "folder" marker exists.
        .filter(o => o.Key && o.Key !== prefix)
        .map(o => ({
          key: o.Key,
          name: o.Key.slice(prefix.length),
          size: o.Size ?? 0,
          lastModified: o.LastModified,
          storageClass: o.StorageClass || '',
        })),
      nextToken: data.IsTruncated ? data.NextContinuationToken : null,
    });
  } catch (err) {
    res.status(err.$metadata?.httpStatusCode || 500).json({ error: err.message });
  }
});

router.get('/check', async (req, res) => {
  const { bucket, region } = req.query;
  const error = validateBucket(bucket);
  if (error) return res.status(400).json({ error });

  try {
    await getClient(region).send(new HeadBucketCommand({ Bucket: bucket }));
    res.json({ ok: true });
  } catch (err) {
    res.status(err.$metadata?.httpStatusCode || 500).json({ error: err.message });
  }
});

router.post('/presign', async (req, res) => {
  const { bucket, key, region, expiresIn } = req.body || {};
  const error = validateBucket(bucket);
  if (error) return res.status(400).json({ error });
  if (!key || typeof key !== 'string' || key.length > 1024) {
    return res.status(400).json({ error: 'A valid object key is required.' });
  }

  const seconds = clampExpiry(expiresIn);
  try {
    const url = await getSignedUrl(
      getClient(region),
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: seconds }
    );
    res.json({
      url,
      expiresIn: seconds,
      expiresAt: new Date(Date.now() + seconds * 1000).toISOString(),
    });
  } catch (err) {
    res.status(err.$metadata?.httpStatusCode || 500).json({ error: err.message });
  }
});

export default router;
