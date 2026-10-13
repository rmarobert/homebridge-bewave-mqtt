import { BeWaveMqttPlatform } from '../platform';
import { PLUGIN_NAME, PLATFORM_NAME } from '../settings';

export function setupAcmd200Accessory(
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
      accessory.context.deviceType = 'ACMD_200';

      platform.api.registerPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        [accessory],
      );

      platform.log.info(`HomeKit CO-melder aangemaakt: ${name}`);
    }

    platform.deviceAccessories.set(index, accessory);
  }


  const coService =
    accessory.getService(platform.api.hap.Service.CarbonMonoxideSensor) ||
    accessory.addService(
      platform.api.hap.Service.CarbonMonoxideSensor,
      `${name} CO`,
      'co',
    );

  coService.setPrimaryService();

  const temperatureService =
    accessory.getService(platform.api.hap.Service.TemperatureSensor) ||
    accessory.addService(
      platform.api.hap.Service.TemperatureSensor,
      `${name} temperatuur`,
      'temperature',
    );

  if ('gas' in data) {
    coService.updateCharacteristic(
      platform.api.hap.Characteristic.CarbonMonoxideDetected,
      Number(data.gas) === 1
        ? platform.api.hap.Characteristic.CarbonMonoxideDetected.CO_LEVELS_ABNORMAL
        : platform.api.hap.Characteristic.CarbonMonoxideDetected.CO_LEVELS_NORMAL,
    );
  }

  if ('temperature' in data) {
    temperatureService.updateCharacteristic(
      platform.api.hap.Characteristic.CurrentTemperature,
      Number(data.temperature),
    );
  }
}
