// File: app/api/devices_router.js
import { Router } from 'express';
import { notFound } from '../core/errors.js';
import { uuidParam, validate } from '../core/validators.js';
import { deleteDevice, listDevices, upsertDevice } from '../crud/device_crud.js';
import { RegisterDeviceRequest, toDeviceOut } from '../schemas/misc_schema.js';

const router = Router();

router.get('', async (req, res) => {
  res.json((await listDevices(req.user.id)).map(toDeviceOut));
});

router.post('', validate({ body: RegisterDeviceRequest }), async (req, res) => {
  res.json(toDeviceOut(await upsertDevice(req.user.id, req.body)));
});

router.delete('/:id', validate({ params: uuidParam() }), async (req, res) => {
  if (!(await deleteDevice(req.user.id, req.params.id))) throw notFound('Device not found');
  res.status(204).end();
});

export default router;
