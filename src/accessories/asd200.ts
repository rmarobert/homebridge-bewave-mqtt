import { BeWaveMqttPlatform } from '../platform';
import { PLUGIN_NAME, PLATFORM_NAME } from '../settings';

export function setupAsd200Accessory(
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
      accessory.context.deviceType = 'ASD_200';

      platform.api.registerPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        [accessory],
      );

      platform.log.info(`HomeKit rookmelder aangemaakt: ${name}`);
    }

    platform.deviceAccessories.set(index, accessory);
  }

  const smokeService =
    accessory.getService(platform.api.hap.Service.SmokeSensor) ||
    accessory.addService(
      platform.api.hap.Service.SmokeSensor,
      `${name} rook`,
      'smoke',
    );

  smokeService.setPrimaryService();

  const temperatureService =
    accessory.getService(platform.api.hap.Service.TemperatureSensor) ||
    accessory.addService(
      platform.api.hap.Service.TemperatureSensor,
      `${name} temperatuur`,
      'temperature',
    );

  const batteryService =
    accessory.getService(platform.api.hap.Service.Battery) ||
    accessory.addService(
      platform.api.hap.Service.Battery,
      `${name} batterij`,
      'battery',
    );

  if ('smoke' in data) {
    smokeService.updateCharacteristic(
      platform.api.hap.Characteristic.SmokeDetected,
      Number(data.smoke) === 1
        ? platform.api.hap.Characteristic.SmokeDetected.SMOKE_DETECTED
        : platform.api.hap.Characteristic.SmokeDetected.SMOKE_NOT_DETECTED,
    );
  }

  if ('temperature' in data) {
    temperatureService.updateCharacteristic(
      platform.api.hap.Characteristic.CurrentTemperature,
      Number(data.temperature),
    );
  }

  if ('battery' in data) {
    const battery = Number(data.battery);

    batteryService.updateCharacteristic(
      platform.api.hap.Characteristic.BatteryLevel,
      battery,
    );

    batteryService.updateCharacteristic(
      platform.api.hap.Characteristic.StatusLowBattery,
      battery <= 20
        ? platform.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
        : platform.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL,
    );

    accessory.context.battery = battery;
  }

  if ('signal' in data) {
    accessory.context.signal = Number(data.signal);
  }

  if ('voltage_supply' in data) {
    accessory.context.voltageSupply = Number(data.voltage_supply);
  }
}
