import { useState } from 'react';
import { useConfig } from '../context/ConfigContext';

// Per-browser Semaphore API token, persisted in localStorage via config context.
export default function SemTokenField() {
  const { semToken, setSemToken } = useConfig();
  const [value, setValue] = useState(semToken);
  const [show, setShow] = useState(false);
  const dirty = value.trim() !== semToken;

  return (
    <div>
      <label className="brutal-label">SEMAPHORE API TOKEN</label>
      <div className="flex flex-wrap gap-2">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="SEMAPHORE API TOKEN"
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
          onClick={() => setSemToken(value.trim())}
          disabled={!dirty}
          className="btn-accent"
        >
          {dirty ? 'Save' : 'Saved'}
        </button>
      </div>
    </div>
  );
}
