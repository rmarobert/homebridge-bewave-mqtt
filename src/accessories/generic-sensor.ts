import type { BeWaveMqttPlatform } from '../platform';
import { PLUGIN_NAME, PLATFORM_NAME } from '../settings';

/**
 * Fallback for BE WAVE device models without a dedicated HomeKit adapter.
 * Exposes only capabilities present in the MQTT payload, without guessing
 * functionality from the model name. Dedicated adapters take precedence.
 */
export function setupGenericSensorAccessory(
  platform: BeWaveMqttPlatform,
  index: string,
  name: string,
  data: Record<string, unknown>,
  deviceType: string,
): void {
  const { Service, Characteristic } = platform.api.hap;
  const definitions = [
    { key: 'motion', service: Service.MotionSensor, characteristic: Characteristic.MotionDetected, subtype: 'motion' },
    { key: 'magnetic', service: Service.ContactSensor, characteristic: Characteristic.ContactSensorState, subtype: 'contact' },
    { key: 'flood', service: Service.LeakSensor, characteristic: Characteristic.LeakDetected, subtype: 'leak' },
    { key: 'smoke', service: Service.SmokeSensor, characteristic: Characteristic.SmokeDetected, subtype: 'smoke' },
    { key: 'temperature', service: Service.TemperatureSensor, characteristic: Characteristic.CurrentTemperature, subtype: 'temperature' },
    { key: 'humidity', service: Service.HumiditySensor, characteristic: Characteristic.CurrentRelativeHumidity, subtype: 'humidity' },
  ] as const;

  const uuid = platform.api.hap.uuid.generate(`bewave-mqtt-${index}`);
  let accessory = platform.deviceAccessories.get(index) ??
    platform.accessories.find(a => a.UUID === uuid);

  // Never expose an unknown device as an empty accessory.
  if (!accessory && !definitions.some(def => Object.hasOwn(data, def.key))) {
    return;
  }

  if (!accessory) {
    accessory = new platform.api.platformAccessory(name, uuid);
    accessory.context.deviceIndex = index;
    accessory.context.deviceType = deviceType;
    platform.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    platform.log.info(`HomeKit generieke BE WAVE sensor aangemaakt: ${name} (${deviceType})`);
  }

  accessory.context.deviceIndex = index;
  accessory.context.deviceType = deviceType;
  platform.deviceAccessories.set(index, accessory);

  let primaryAssigned = accessory.services.some(s => s.isPrimaryService);
  for (const def of definitions) {
    // Restore existing services even before receiving the first fresh state.
    const existing = accessory.getServiceById(def.service, def.subtype);
    if (!existing && !Object.hasOwn(data, def.key)) continue;

    const service = existing ??
      accessory.addService(def.service, `${name} ${def.subtype}`, def.subtype);

    if (!primaryAssigned) {
      service.setPrimaryService();
      primaryAssigned = true;
    }

    if (!Object.hasOwn(data, def.key)) continue;
    const value = Number(data[def.key]);
    if (!Number.isFinite(value)) continue;

    if (def.key === 'temperature') {
      if (value >= -270 && value <= 100) {
        service.updateCharacteristic(def.characteristic, value);
      }
    } else if (def.key === 'humidity') {
      if (value >= 0 && value <= 100) {
        service.updateCharacteristic(def.characteristic, value);
      }
    } else if (value === 0 || value === 1) {
      // BE WAVE magnetic=1 means opening detected. HomeKit uses 1 for open.
      service.updateCharacteristic(def.characteristic, value);
    }
  }
}
