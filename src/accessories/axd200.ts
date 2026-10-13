import { BeWaveMqttPlatform } from '../platform';
import { PLUGIN_NAME, PLATFORM_NAME } from '../settings';

export function setupAxd200Accessory(
  platform: BeWaveMqttPlatform,
  index: string,
  name: string,
  data: Record<string, unknown>,
): void {
  let accessory = platform.deviceAccessories.get(index);

  const uuid = platform.api.hap.uuid.generate(`bewave-mqtt-${index}`);

  if (!accessory) {
    accessory = platform.accessories.find(a => a.UUID === uuid);

    if (!accessory) {
      accessory = new platform.api.platformAccessory(name, uuid);

      accessory.context.deviceIndex = index;
      accessory.context.deviceType = 'AXD_200';

      platform.api.registerPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        [accessory],
      );

      platform.log.info(`HomeKit contactsensor aangemaakt: ${name}`);
    }

    platform.deviceAccessories.set(index, accessory);
  }

  const contactService =
    accessory.getService(platform.api.hap.Service.ContactSensor) ||
    accessory.addService(
      platform.api.hap.Service.ContactSensor,
      `${name} contact`,
      'contact',
    );

  contactService.setPrimaryService();

  const temperatureService =
    accessory.getService(platform.api.hap.Service.TemperatureSensor) ||
    accessory.addService(
      platform.api.hap.Service.TemperatureSensor,
      `${name} temperatuur`,
      'temperature',
    );

  if ('magnetic' in data) {
    contactService.updateCharacteristic(
      platform.api.hap.Characteristic.ContactSensorState,
      Number(data.magnetic) === 1
        ? platform.api.hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
        : platform.api.hap.Characteristic.ContactSensorState.CONTACT_DETECTED,
    );
  }

  if ('temperature' in data) {
    temperatureService.updateCharacteristic(
      platform.api.hap.Characteristic.CurrentTemperature,
      Number(data.temperature),
    );
  }
}

