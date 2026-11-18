import type { BeWaveMqttPlatform } from '../platform';
import { PLUGIN_NAME, PLATFORM_NAME } from '../settings';

/** Covers a shutter only when BE WAVE explicitly reports its position. */
export function setupShutterAccessory(
  platform: BeWaveMqttPlatform, index: string, name: string,
  data: Record<string, unknown>, deviceType: string,
): void {
  const { Service, Characteristic } = platform.api.hap;
  const uuid = platform.api.hap.uuid.generate(`bewave-mqtt-${index}`);
  let accessory = platform.deviceAccessories.get(index) ??
    platform.accessories.find(a => a.UUID === uuid);
  if (!accessory) {
    accessory = new platform.api.platformAccessory(name, uuid);
    accessory.context.deviceIndex = index;
    accessory.context.deviceType = deviceType;
    platform.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
  }
  accessory.context.deviceIndex = index;
  accessory.context.deviceType = deviceType;
  platform.deviceAccessories.set(index, accessory);

  const service = accessory.getService(Service.WindowCovering) ??
    accessory.addService(Service.WindowCovering, name, 'shutter');
  service.setPrimaryService();
  const position = Number(data.shutter_value);
  if (Number.isFinite(position) && position >= 0 && position <= 100) {
    service.updateCharacteristic(Characteristic.CurrentPosition, position);
    if (Number(data.shutter_operation_pending) !== 1) {
      service.updateCharacteristic(Characteristic.TargetPosition, position);
    }
  }
  if ('shutter_operation_pending' in data) {
    service.updateCharacteristic(
      Characteristic.PositionState,
      Number(data.shutter_operation_pending) === 1
        ? Characteristic.PositionState.STOPPED
        : Characteristic.PositionState.STOPPED,
    );
  }
  if ('shutter_inclination_value' in data) {
    const inclination = Number(data.shutter_inclination_value);
    if (Number.isFinite(inclination) && inclination >= 0 && inclination <= 100) {
      service.updateCharacteristic(Characteristic.CurrentHorizontalTiltAngle, inclination * 1.8 - 90);
    }
  }

  if (platform.boundDevices.has(index)) return;
  platform.boundDevices.add(index);
  const topic = `${platform.config.commandPrefix || 'bewave/command'}/devices/${index}/rx`;
  service.getCharacteristic(Characteristic.TargetPosition).onSet(async value => {
    const position = Number(value);
    if (!Number.isFinite(position) || position < 0 || position > 100) return;
    await platform.sendCommand(topic, { shutter_value: Math.round(position) });
  });
  // Slat control is exposed only if the device publishes a slat value.
  if ('shutter_inclination_value' in data ||
      service.testCharacteristic?.(Characteristic.TargetHorizontalTiltAngle)) {
    service.getCharacteristic(Characteristic.TargetHorizontalTiltAngle).onSet(async value => {
      const inclination = Math.max(0, Math.min(100, Math.round((Number(value) + 90) / 1.8)));
      await platform.sendCommand(topic, { shutter_inclination_value: inclination });
    });
  }
}
