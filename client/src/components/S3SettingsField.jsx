import { useState } from 'react';
import { useConfig } from '../context/ConfigContext';

const REGIONS = [
  'eu-west-2', 'eu-west-1', 'eu-central-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
];

// SigV4 caps presigned URL lifetime at 7 days.
const MAX_MINUTES = 10080;
const MIN_MINUTES = 1;

export default function S3SettingsField() {
  const { s3Bucket, s3Region, s3Expiry, setS3Settings } = useConfig();
  const [bucket, setBucket] = useState(s3Bucket);
  const [region, setRegion] = useState(s3Region);
  const [minutes, setMinutes] = useState(String(Math.round(s3Expiry / 60)));

  const parsedMinutes = Number.parseInt(minutes, 10);
  const minutesValid = Number.isFinite(parsedMinutes) && parsedMinutes >= MIN_MINUTES && parsedMinutes <= MAX_MINUTES;
  const dirty =
    bucket.trim() !== s3Bucket ||
    region !== s3Region ||
    (minutesValid && parsedMinutes * 60 !== s3Expiry);

  const save = () => {
    setS3Settings({ bucket: bucket.trim(), region, expiry: parsedMinutes * 60 });
  };

  return (
    <div className="space-y-2">
      <div>
        <label className="brutal-label">S3 BUCKET NAME</label>
        <input
          type="text"
          value={bucket}
          onChange={(e) => setBucket(e.target.value)}
          placeholder="S3 BUCKET NAME"
          className="brutal-input w-full sm:w-96"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div>
        <label className="brutal-label">S3 REGION</label>
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="brutal-input w-full sm:w-96">
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="brutal-label">PRESIGNED URL EXPIRY (MINUTES)</label>
        <div className="flex flex-wrap gap-2">
          <input
            type="number"
            min={MIN_MINUTES}
            max={MAX_MINUTES}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="brutal-input flex-1 min-w-0 sm:flex-none sm:w-96"
          />
          <button
            type="button"
            onClick={save}
            disabled={!dirty || !minutesValid}
            className="btn-accent"
          >
            {dirty ? 'Save' : 'Saved'}
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-1">
          Maximum 10,080 minutes (7 days). Temporary AWS credentials may cause the URL to expire sooner.
        </p>
        {!minutesValid && (
          <p className="text-xs text-red-400 mt-1">Enter between {MIN_MINUTES} and {MAX_MINUTES} minutes (7 days max).</p>
        )}
      </div>
    </div>
  );
}
