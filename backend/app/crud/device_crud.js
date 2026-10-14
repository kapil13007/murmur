// File: app/crud/device_crud.js
import { Device } from '../models/index.js';

export async function upsertDevice(userId, data) {
  const [device] = await Device.findOrCreate({
    where: { user_id: userId, device_uid: data.device_uid },
    defaults: { ...data, user_id: userId },
  });
  Object.assign(device, {
    platform: data.platform,
    arch: data.arch ?? device.arch,
    device_name: data.device_name ?? device.device_name,
    app_version: data.app_version ?? device.app_version,
    last_seen_at: new Date(),
  });
  await device.save();
  return device;
}

export function getDeviceByUid(userId, deviceUid) {
  if (!deviceUid) return null;
  return Device.findOne({ where: { user_id: userId, device_uid: deviceUid } });
}

export function listDevices(userId) {
  return Device.findAll({ where: { user_id: userId }, order: [['last_seen_at', 'DESC']] });
}

export async function deleteDevice(userId, id) {
  return Device.destroy({ where: { user_id: userId, id } });
}
