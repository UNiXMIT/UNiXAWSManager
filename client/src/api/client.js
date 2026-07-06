const BASE = '/api';

async function request(method, path, body = null, params = null) {
  const url = new URL(BASE + path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null) url.searchParams.set(k, String(v));
    });
  }
  const opts = { method, headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url.toString(), opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Instances
  listInstances: (owner, region) => request('GET', '/instances', null, { owner, region }),
  listAmis: (region) => request('GET', '/instances/amis', null, { region }),
  listSem: () => request('GET', '/instances/sem'),
  startInstance: (id, region) => request('POST', `/instances/${id}/start`, { region }),
  stopInstance: (id, region) => request('POST', `/instances/${id}/stop`, { region }),
  rebootInstance: (id, region) => request('POST', `/instances/${id}/reboot`, { region }),
  renameInstance: (id, name, region) => request('POST', `/instances/${id}/rename`, { name, region }),
  changeOwner: (id, owner, region) => request('POST', `/instances/${id}/owner`, { owner, region }),
  setProtection: (id, enabled, region) => request('POST', `/instances/${id}/protection`, { enabled, region }),
  terminateInstance: (id, region, scope = {}) => request('DELETE', `/instances/${id}`, null, { region, ...scope }),
  terminateBatch: (ids, region, scope = {}) => request('POST', '/instances/terminate-batch', { ids, region, ...scope }),
  terminateAll: (owner, region) => request('DELETE', `/instances/terminate-all`, null, { owner, region }),

  getInstanceProtection: (id, region) => request('GET', `/instances/${id}/protection`, null, { region }),

  // Security Groups
  getSgDetails: (id, region) => request('GET', `/security-groups/${id}`, null, { region }),
  createSg: (name, description, vpcId, region) => request('POST', '/security-groups', { name, description, vpcId, region }),
  deleteSg: (id, region) => request('DELETE', `/security-groups/${id}`, null, { region }),
  addIpToSg: (id, ip, description, region) => request('POST', `/security-groups/${id}/rules`, { ip, description, region }),
  revokeIpFromSg: (id, ip, region) => request('DELETE', `/security-groups/${id}/rules`, null, { ip, region }),
  attachSgToInstance: (instanceId, groupIds, region) =>
    request('POST', '/security-groups/attach', { instanceId, groupIds, region }),

  // Semaphore
  semGetProjects: () => request('GET', '/semaphore/projects'),
  semGetViews: (projectId) => request('GET', `/semaphore/projects/${projectId}/views`),
  semGetTemplates: (projectId) => request('GET', `/semaphore/projects/${projectId}/templates`),
  semStartTask: (projectId, templateId, vars) =>
    request('POST', `/semaphore/projects/${projectId}/tasks`, { templateId, ...vars }),

  // Utils
  getMyIp: () => request('GET', '/myip'),
  getConfig: () => request('GET', '/config'),
};
