import { Router } from 'express';
import {
  EC2Client,
  DescribeSecurityGroupsCommand,
  CreateSecurityGroupCommand,
  DeleteSecurityGroupCommand,
  AuthorizeSecurityGroupIngressCommand,
  RevokeSecurityGroupIngressCommand,
  ModifyInstanceAttributeCommand,
} from '@aws-sdk/client-ec2';

const router = Router();
const DEFAULT_REGION = 'eu-west-2';
const DEFAULT_VPC = 'vpc-6e7f1d06';

const getClient = (region = DEFAULT_REGION) => new EC2Client({ region });

// POST /api/security-groups/attach — must be before /:id routes
router.post('/attach', async (req, res) => {
  const { instanceId, groupIds, region = DEFAULT_REGION } = req.body;
  try {
    await getClient(region).send(
      new ModifyInstanceAttributeCommand({ InstanceId: instanceId, Groups: groupIds })
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/security-groups — create
router.post('/', async (req, res) => {
  const { name, description, vpcId = DEFAULT_VPC, region = DEFAULT_REGION } = req.body;
  try {
    const data = await getClient(region).send(
      new CreateSecurityGroupCommand({ GroupName: name, Description: description, VpcId: vpcId })
    );
    res.json({ groupId: data.GroupId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/security-groups/:id?region=
router.get('/:id', async (req, res) => {
  const { region = DEFAULT_REGION } = req.query;
  try {
    const data = await getClient(region).send(
      new DescribeSecurityGroupsCommand({ GroupIds: [req.params.id] })
    );
    const sg = data.SecurityGroups?.[0];
    if (!sg) return res.status(404).json({ error: 'Security group not found' });

    const rules = sg.IpPermissions?.flatMap(p =>
      (p.IpRanges || []).map(r => ({
        cidr: r.CidrIp,
        description: r.Description || '',
        protocol: p.IpProtocol,
        fromPort: p.FromPort,
        toPort: p.ToPort,
      }))
    ) || [];

    res.json({
      groupId: sg.GroupId,
      groupName: sg.GroupName,
      description: sg.Description,
      vpcId: sg.VpcId,
      rules,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/security-groups/:id?region=
router.delete('/:id', async (req, res) => {
  const { region = DEFAULT_REGION } = req.query;
  try {
    await getClient(region).send(new DeleteSecurityGroupCommand({ GroupId: req.params.id }));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/security-groups/:id/rules — add IP
router.post('/:id/rules', async (req, res) => {
  const { ip, description = '', region = DEFAULT_REGION } = req.body;
  const cidr = ip.includes('/') ? ip : `${ip}/32`;
  try {
    await getClient(region).send(
      new AuthorizeSecurityGroupIngressCommand({
        GroupId: req.params.id,
        IpPermissions: [{ IpProtocol: '-1', IpRanges: [{ CidrIp: cidr, Description: description }] }],
      })
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/security-groups/:id/rules?ip=&region= — revoke IP
router.delete('/:id/rules', async (req, res) => {
  const { ip, region = DEFAULT_REGION } = req.query;
  const cidr = ip.includes('/') ? ip : `${ip}/32`;
  try {
    await getClient(region).send(
      new RevokeSecurityGroupIngressCommand({
        GroupId: req.params.id,
        IpPermissions: [{ IpProtocol: '-1', IpRanges: [{ CidrIp: cidr }] }],
      })
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
