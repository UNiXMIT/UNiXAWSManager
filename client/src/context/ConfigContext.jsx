import { createContext, useContext, useEffect, useState } from 'react';
import { api, SEM_TOKEN_KEY } from '../api/client';

const FALLBACK = { defaultOwner: '', defaultRegion: 'all' };
const OWNER_KEY = 'awsmanager.owner';
const REGION_KEY = 'awsmanager.region';

const ConfigContext = createContext({
  ...FALLBACK,
  owner: '',
  region: 'all',
  semToken: '',
  setOwner: () => {},
  setRegion: () => {},
  setSemToken: () => {},
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

  const value = { ...config, owner, region, semToken, setOwner, setRegion, setSemToken };
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    api.getConfig()
      .then(cfg => setConfig({
        defaultOwner: cfg.defaultOwner ?? FALLBACK.defaultOwner,
        defaultRegion: cfg.defaultRegion || FALLBACK.defaultRegion,
      }))
      .catch(() => setConfig(FALLBACK));
  }, []);

  if (!config) return null;

  return <ConfigInner config={config}>{children}</ConfigInner>;
}

export const useConfig = () => useContext(ConfigContext);
