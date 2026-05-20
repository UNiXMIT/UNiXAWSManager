import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const ConfigContext = createContext({ defaultOwner: 'MTURNER', defaultRegion: 'eu-west-2' });

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    api.getConfig()
      .then(setConfig)
      .catch(() => setConfig({ defaultOwner: 'MTURNER', defaultRegion: 'eu-west-2' }));
  }, []);

  if (!config) return null;

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export const useConfig = () => useContext(ConfigContext);
