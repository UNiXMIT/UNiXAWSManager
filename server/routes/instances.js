import { Router } from 'express';
import {
  EC2Client,
  DescribeInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  RebootInstancesCommand,
  CreateTagsCommand,
  ModifyInstanceAttributeCommand,
  TerminateInstancesCommand,
  DescribeImagesCommand,
  DescribeRegionsCommand,
} from '@aws-sdk/client-ec2';

const router = Router();
const PROTECTED_INSTANCE = 'i-0b93bc56752494396';
const DEFAULT_REGION = 'eu-west-2';

const getClient = (region = DEFAULT_REGION) => new EC2Client({ region });

const getTagValue = (instance, key) => instance.Tags?.find(tag => tag.Key === key)?.Value || '';

const isSemInstance = (instance) => getTagValue(instance, 'Name').toUpperCase().startsWith('SEM');

async function getInstancesByIds(region, ids) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (!uniqueIds.length) return [];

  const data = await getClient(region).send(new DescribeInstancesCommand({ InstanceIds: uniqueIds }));
  return data.Reservations?.flatMap(r => r.Instances || []) || [];
}

function getTerminationScopeError(instance, { owner, semOnly }) {
  if (!owner && !semOnly) {
    return 'Termination scope is required.';
  }

  if (owner && getTagValue(instance, 'Owner') !== owner) {
    return `Instance ${instance.InstanceId} is not owned by ${owner}.`;
  }

  if (semOnly && !isSemInstance(instance)) {
    return `Instance ${instance.InstanceId} is not a SEM instance.`;
  }

  return null;
}

function formatInstance(i) {
  return {
    instanceId: i.InstanceId,
    name: i.Tags?.find(t => t.Key === 'Name')?.Value || '',
    owner: i.Tags?.find(t => t.Key === 'Owner')?.Value || '',
    semStatus: i.Tags?.find(t => t.Key === 'SemStatus')?.Value || '',
    state: i.State?.Name,
    publicIp: i.PublicIpAddress || '',
    privateIp: i.PrivateIpAddress || '',
    publicDns: i.PublicDnsName || '',
    instanceType: i.InstanceType || '',
    launchTime: i.LaunchTime,
    securityGroups: (i.SecurityGroups || []).map(sg => ({
      groupId: sg.GroupId,
      groupName: sg.GroupName,
    })),
    subnetId: i.SubnetId || '',
    vpcId: i.VpcId || '',
  };
}

// GET /api/instances?owner=&region=
router.get('/', async (req, res) => {
  const { owner, region = DEFAULT_REGION } = req.query;
  const filters = [
    { Name: 'instance-state-name', Values: ['pending', 'running', 'shutting-down', 'stopped', 'stopping'] },
  ];
  if (owner) filters.push({ Name: 'tag:Owner', Values: [owner] });
  try {
    const data = await getClient(region).send(new DescribeInstancesCommand({ Filters: filters }));
    res.json(data.Reservations?.flatMap(r => r.Instances || []).map(formatInstance) || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/instances/sem — queries all available regions
router.get('/sem', async (_req, res) => {
  try {
    // Discover all opt-in-not-required regions
    const regionsData = await getClient(DEFAULT_REGION).send(
      new DescribeRegionsCommand({ Filters: [{ Name: 'opt-in-status', Values: ['opt-in-not-required', 'opted-in'] }] })
    );
    const regions = (regionsData.Regions || []).map(r => r.RegionName);

    const results = await Promise.all(
      regions.map(async region => {
        try {
          const data = await getClient(region).send(
            new DescribeInstancesCommand({ Filters: [{ Name: 'tag:Name', Values: ['SEM*'] }] })
          );
          const instances = data.Reservations?.flatMap(r => r.Instances || []).map(formatInstance) || [];
          return instances.length > 0 ? { region, instances } : null;
        } catch {
          return null; // skip regions we can't access
        }
      })
    );

    res.json(results.filter(Boolean).sort((a, b) => a.region.localeCompare(b.region)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/instances/amis?region=
router.get('/amis', async (req, res) => {
  const { region = DEFAULT_REGION } = req.query;
  try {
    const data = await getClient(region).send(new DescribeImagesCommand({ Owners: ['self'] }));
    const amis = (data.Images || [])
      .map(img => ({
        imageId: img.ImageId,
        name: img.Name,
        owner: img.Tags?.find(t => t.Key === 'Owner')?.Value || '',
        creationDate: img.CreationDate,
        state: img.State,
      }))
      .sort((a, b) => (b.creationDate || '').localeCompare(a.creationDate || ''));
    res.json(amis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/instances/terminate-all?owner=&region=
// Must be defined before /:id
router.delete('/terminate-all', async (req, res) => {
  const { owner, region = DEFAULT_REGION } = req.query;
  if (!owner) return res.status(400).json({ error: 'Owner is required' });
  try {
    const data = await getClient(region).send(
      new DescribeInstancesCommand({
        Filters: [
          { Name: 'tag:Owner', Values: [owner] },
          { Name: 'instance-state-name', Values: ['pending', 'running', 'shutting-down', 'stopped', 'stopping'] },
        ],
      })
    );
    const ids = (data.Reservations?.flatMap(r => r.Instances || []) || [])
      .map(i => i.InstanceId)
      .filter(id => id !== PROTECTED_INSTANCE);

    if (!ids.length) return res.json({ terminated: [], message: 'No instances to terminate.' });
    await getClient(region).send(new TerminateInstancesCommand({ InstanceIds: ids }));
    res.json({ terminated: ids });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/instances/terminate-batch
// Body: { ids: [], region, owner?, semOnly? }
router.post('/terminate-batch', async (req, res) => {
  const {
    ids,
    region = DEFAULT_REGION,
    owner,
    semOnly = false,
  } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'At least one instance ID is required.' });
  }

  if (!owner && !semOnly) {
    return res.status(400).json({ error: 'Termination scope is required.' });
  }

  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const protectedIds = uniqueIds.filter(id => id === PROTECTED_INSTANCE);
  const requestedIds = uniqueIds.filter(id => id !== PROTECTED_INSTANCE);

  if (!requestedIds.length) {
    return res.json({ terminated: [], skippedProtected: protectedIds });
  }

  try {
    const instances = await getInstancesByIds(region, requestedIds);
    const foundIds = new Set(instances.map(instance => instance.InstanceId));
    const missingIds = requestedIds.filter(id => !foundIds.has(id));

    if (missingIds.length) {
      return res.status(404).json({ error: `Instance(s) not found: ${missingIds.join(', ')}` });
    }

    for (const instance of instances) {
      const scopeError = getTerminationScopeError(instance, { owner, semOnly: !!semOnly });
      if (scopeError) return res.status(403).json({ error: scopeError });
    }

    await getClient(region).send(new TerminateInstancesCommand({ InstanceIds: requestedIds }));
    res.json({ terminated: requestedIds, skippedProtected: protectedIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/instances/:id/start
router.post('/:id/start', async (req, res) => {
  const { region = DEFAULT_REGION } = req.body;
  try {
    await getClient(region).send(new StartInstancesCommand({ InstanceIds: [req.params.id] }));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/instances/:id/stop
router.post('/:id/stop', async (req, res) => {
  const { region = DEFAULT_REGION } = req.body;
  try {
    await getClient(region).send(new StopInstancesCommand({ InstanceIds: [req.params.id] }));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/instances/:id/reboot
router.post('/:id/reboot', async (req, res) => {
  const { region = DEFAULT_REGION } = req.body;
  try {
    await getClient(region).send(new RebootInstancesCommand({ InstanceIds: [req.params.id] }));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/instances/:id/rename
router.post('/:id/rename', async (req, res) => {
  const { name, region = DEFAULT_REGION } = req.body;
  try {
    await getClient(region).send(
      new CreateTagsCommand({ Resources: [req.params.id], Tags: [{ Key: 'Name', Value: name }] })
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/instances/:id/owner
router.post('/:id/owner', async (req, res) => {
  const { owner, region = DEFAULT_REGION } = req.body;
  try {
    await getClient(region).send(
      new CreateTagsCommand({ Resources: [req.params.id], Tags: [{ Key: 'Owner', Value: owner }] })
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/instances/:id/protection
router.post('/:id/protection', async (req, res) => {
  const { enabled, region = DEFAULT_REGION } = req.body;
  const client = getClient(region);
  try {
    await client.send(
      new ModifyInstanceAttributeCommand({
        InstanceId: req.params.id,
        DisableApiStop: { Value: !!enabled },
      })
    );
    await client.send(
      new ModifyInstanceAttributeCommand({
        InstanceId: req.params.id,
        DisableApiTermination: { Value: !!enabled },
      })
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/instances/:id?region=
router.delete('/:id', async (req, res) => {
  const { region = DEFAULT_REGION, owner, semOnly } = req.query;
  if (req.params.id === PROTECTED_INSTANCE) {
    return res.status(403).json({ error: `Instance ${PROTECTED_INSTANCE} is protected and cannot be terminated.` });
  }

  if (!owner && semOnly !== 'true') {
    return res.status(400).json({ error: 'Termination scope is required.' });
  }

  try {
    const [instance] = await getInstancesByIds(region, [req.params.id]);
    if (!instance) {
      return res.status(404).json({ error: `Instance ${req.params.id} not found.` });
    }

    const scopeError = getTerminationScopeError(instance, { owner, semOnly: semOnly === 'true' });
    if (scopeError) {
      return res.status(403).json({ error: scopeError });
    }

    await getClient(region).send(new TerminateInstancesCommand({ InstanceIds: [req.params.id] }));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
