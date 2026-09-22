import { createContext, useContext, useEffect, useState } from 'react';
import {
  api,
  SEM_TOKEN_KEY,
  AWS_ACCESS_KEY_ID_KEY,
  AWS_SECRET_ACCESS_KEY_KEY,
  S3_BUCKET_KEY,
  S3_REGION_KEY,
  S3_EXPIRY_KEY,
} from '../api/client';

const FALLBACK = {
  defaultOwner: '',
  defaultRegion: 'all',
  defaultS3Bucket: '',
  defaultS3Region: 'eu-west-2',
  defaultS3Expiry: 3600,
};
const OWNER_KEY = 'awsmanager.owner';
const REGION_KEY = 'awsmanager.region';

const ConfigContext = createContext({
  ...FALLBACK,
  owner: '',
  region: 'all',
  semToken: '',
  awsAccessKeyId: '',
  awsSecretAccessKey: '',
  hasAwsCreds: false,
  s3Bucket: '',
  s3Region: 'eu-west-2',
  s3Expiry: 3600,
  setOwner: () => {},
  setRegion: () => {},
  setSemToken: () => {},
  setAwsCreds: () => {},
  setS3Settings: () => {},
});

function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore persistence failures (e.g. private mode)
  }
}

function ConfigInner({ config, children }) {
  // Persisted per-browser choices override the server-provided defaults.
  const [owner, setOwnerState] = useState(() => {
    const stored = readStored(OWNER_KEY);
    return stored != null ? stored : config.defaultOwner;
  });
  const [region, setRegionState] = useState(() => {
    return readStored(REGION_KEY) || config.defaultRegion;
  });
  const [semToken, setSemTokenState] = useState(() => readStored(SEM_TOKEN_KEY) || '');
  const [awsAccessKeyId, setAwsAccessKeyIdState] = useState(() => readStored(AWS_ACCESS_KEY_ID_KEY) || '');
  const [awsSecretAccessKey, setAwsSecretAccessKeyState] = useState(() => readStored(AWS_SECRET_ACCESS_KEY_KEY) || '');
  const [s3Bucket, setS3BucketState] = useState(() => readStored(S3_BUCKET_KEY) ?? config.defaultS3Bucket);
  const [s3Region, setS3RegionState] = useState(() => readStored(S3_REGION_KEY) || config.defaultS3Region);
  const [s3Expiry, setS3ExpiryState] = useState(() => {
    const stored = Number(readStored(S3_EXPIRY_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : config.defaultS3Expiry;
  });

  const setOwner = (value) => {
    setOwnerState(value);
    writeStored(OWNER_KEY, value);
  };
  const setRegion = (value) => {
    setRegionState(value);
    writeStored(REGION_KEY, value);
  };
  const setSemToken = (value) => {
    setSemTokenState(value);
    writeStored(SEM_TOKEN_KEY, value);
  };
  const setAwsCreds = ({ accessKeyId, secretAccessKey }) => {
    setAwsAccessKeyIdState(accessKeyId);
    setAwsSecretAccessKeyState(secretAccessKey);
    writeStored(AWS_ACCESS_KEY_ID_KEY, accessKeyId);
    writeStored(AWS_SECRET_ACCESS_KEY_KEY, secretAccessKey);
  };
  const setS3Settings = ({ bucket, region: s3reg, expiry }) => {
    setS3BucketState(bucket);
    setS3RegionState(s3reg);
    setS3ExpiryState(expiry);
    writeStored(S3_BUCKET_KEY, bucket);
    writeStored(S3_REGION_KEY, s3reg);
    writeStored(S3_EXPIRY_KEY, String(expiry));
  };

  const hasAwsCreds = !!(awsAccessKeyId.trim() && awsSecretAccessKey.trim());

  const value = {
    ...config,
    owner, region, semToken,
    awsAccessKeyId, awsSecretAccessKey, hasAwsCreds,
    s3Bucket, s3Region, s3Expiry,
    setOwner, setRegion, setSemToken, setAwsCreds, setS3Settings,
  };
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    api.getConfig()
      .then(cfg => setConfig({
        defaultOwner: cfg.defaultOwner ?? FALLBACK.defaultOwner,
        defaultRegion: cfg.defaultRegion || FALLBACK.defaultRegion,
        defaultS3Bucket: cfg.defaultS3Bucket ?? FALLBACK.defaultS3Bucket,
        defaultS3Region: cfg.defaultS3Region || FALLBACK.defaultS3Region,
        defaultS3Expiry: cfg.defaultS3Expiry || FALLBACK.defaultS3Expiry,
      }))
      .catch(() => setConfig(FALLBACK));
  }, []);

  if (!config) return null;

  return <ConfigInner config={config}>{children}</ConfigInner>;
}

export const useConfig = () => useContext(ConfigContext);
