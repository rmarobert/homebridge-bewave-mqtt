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
    // SATEL supplies millivolts, not HomeKit battery percentage.
    // Preserve the raw reading for diagnostics without guessing the charge.
    const batteryMillivolts = Number(data.battery);
    if (Number.isFinite(batteryMillivolts)) {
      accessory.context.batteryMillivolts = batteryMillivolts;
    }
  }

  if ('signal' in data) {
    accessory.context.signal = Number(data.signal);
  }

  if ('voltage_supply' in data) {
    accessory.context.voltageSupply = Number(data.voltage_supply);
  }
}
