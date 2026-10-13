import { PlatformAccessory } from 'homebridge';
import { BeWaveMqttPlatform } from '../platform';

export function updateDeviceInformation(
  platform: BeWaveMqttPlatform,
  accessory: PlatformAccessory,
  deviceType: string,
  data: Record<string, unknown>,
): void {
  const informationService =
    accessory.getService(platform.api.hap.Service.AccessoryInformation);

  if (!informationService) {
    return;
  }

  informationService.setCharacteristic(
    platform.api.hap.Characteristic.Manufacturer,
    'SATEL',
  );

  informationService.setCharacteristic(
    platform.api.hap.Characteristic.Model,
    deviceType.replace(/_/g, '-'),
  );

  if (data.sn !== undefined && data.sn !== null) {
    informationService.setCharacteristic(
      platform.api.hap.Characteristic.SerialNumber,
      String(data.sn),
    );
  }

  if (data.fw_version !== undefined && data.fw_version !== null) {
    informationService.setCharacteristic(
      platform.api.hap.Characteristic.FirmwareRevision,
      String(data.fw_version),
    );
  }
}
