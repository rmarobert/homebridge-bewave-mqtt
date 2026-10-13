import { BeWaveMqttPlatform } from '../platform';
import { PLUGIN_NAME, PLATFORM_NAME } from '../settings';

export function setupApd200Accessory(
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
      accessory.context.deviceType = 'APD_200';

      platform.api.registerPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        [accessory],
      );

      platform.log.info(`HomeKit bewegingssensor aangemaakt: ${name}`);
    }

    platform.deviceAccessories.set(index, accessory);
  }

  const motionService =
    accessory.getService(platform.api.hap.Service.MotionSensor) ||
    accessory.addService(
      platform.api.hap.Service.MotionSensor,
      `${name} beweging`,
      'motion',
    );
  motionService.setPrimaryService();

  const temperatureService =
    accessory.getService(platform.api.hap.Service.TemperatureSensor) ||
    accessory.addService(
      platform.api.hap.Service.TemperatureSensor,
      `${name} temperatuur`,
      'temperature',
    );

  if ('motion' in data) {
    motionService.updateCharacteristic(
      platform.api.hap.Characteristic.MotionDetected,
      Number(data.motion) === 1,
    );
  }

  if ('temperature' in data) {
    temperatureService.updateCharacteristic(
      platform.api.hap.Characteristic.CurrentTemperature,
      Number(data.temperature),
    );
  }
}
