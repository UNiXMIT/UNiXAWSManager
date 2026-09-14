import { useState } from 'react';
import { useConfig } from '../context/ConfigContext';

// Per-browser AWS credentials, persisted in localStorage via config context.
export default function AwsCredsField() {
  const { awsAccessKeyId, awsSecretAccessKey, setAwsCreds } = useConfig();
  const [keyId, setKeyId] = useState(awsAccessKeyId);
  const [secret, setSecret] = useState(awsSecretAccessKey);
  const [show, setShow] = useState(false);

  const dirty = keyId.trim() !== awsAccessKeyId || secret.trim() !== awsSecretAccessKey;

  return (
    <div className="space-y-2">
      <div>
        <label className="brutal-label">AWS ACCESS KEY ID</label>
        <input
          type={show ? 'text' : 'password'}
          value={keyId}
          onChange={(e) => setKeyId(e.target.value)}
          placeholder="AWS ACCESS KEY ID"
          className="brutal-input w-full sm:w-96"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div>
        <label className="brutal-label">AWS SECRET ACCESS KEY</label>
        <div className="flex flex-wrap gap-2">
          <input
            type={show ? 'text' : 'password'}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="AWS SECRET ACCESS KEY"
            className="brutal-input flex-1 min-w-0 sm:flex-none sm:w-96"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="btn-neutral"
          >
            {show ? 'Hide' : 'Show'}
          </button>
          <button
            type="button"
            onClick={() => setAwsCreds({ accessKeyId: keyId.trim(), secretAccessKey: secret.trim() })}
            disabled={!dirty}
            className="btn-accent"
          >
            {dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </div>
    </div>
  );
}
