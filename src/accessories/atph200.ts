import { BeWaveMqttPlatform } from '../platform';
import { PLUGIN_NAME, PLATFORM_NAME } from '../settings';

export function setupAtph200Accessory(
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
      accessory.context.deviceType = 'ATPH_200';

      platform.api.registerPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        [accessory],
      );

      platform.log.info(`HomeKit klimaatsensor aangemaakt: ${name}`);
    }

    platform.deviceAccessories.set(index, accessory);
  }

  const temperatureService =
    accessory.getService(platform.api.hap.Service.TemperatureSensor) ||
    accessory.addService(
      platform.api.hap.Service.TemperatureSensor,
      `${name} temperatuur`,
      'temperature',
    );

  temperatureService.setPrimaryService();

  const humidityService =
    accessory.getService(platform.api.hap.Service.HumiditySensor) ||
    accessory.addService(
      platform.api.hap.Service.HumiditySensor,
      `${name} luchtvochtigheid`,
      'humidity',
    );

  if ('temperature' in data) {
    temperatureService.updateCharacteristic(
      platform.api.hap.Characteristic.CurrentTemperature,
      Number(data.temperature),
    );
  }

  if ('humidity' in data) {
    humidityService.updateCharacteristic(
      platform.api.hap.Characteristic.CurrentRelativeHumidity,
      Number(data.humidity),
    );
  }
}

