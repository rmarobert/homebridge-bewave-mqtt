import { BeWaveMqttPlatform } from '../platform';
import { PLUGIN_NAME, PLATFORM_NAME } from '../settings';

export function setupVirtualIpAccessory(
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
      accessory.context.deviceType = 'VIRTUAL_IP_DEVICE';

      platform.api.registerPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        [accessory],
      );

      platform.log.info(`HomeKit virtueel IP-device aangemaakt: ${name}`);
    }

    platform.deviceAccessories.set(index, accessory);
  }

  const switchService =
    accessory.getService(platform.api.hap.Service.Switch) ||
    accessory.addService(
      platform.api.hap.Service.Switch,
      name,
      'switch',
    );

  switchService.setPrimaryService();

  if ('on_off' in data) {
    switchService.updateCharacteristic(
      platform.api.hap.Characteristic.On,
      Number(data.on_off) === 1,
    );
  }

  if ('motion' in data) {
    accessory.context.motion = Number(data.motion);
  }

  if ('violation' in data) {
    accessory.context.violation = Number(data.violation);
  }

  if (!platform.boundDevices.has(index)) {
    platform.boundDevices.add(index);

    const commandTopic =
      `${platform.config.commandPrefix || 'bewave/command'}/devices/${index}/rx`;

    switchService
      .getCharacteristic(platform.api.hap.Characteristic.On)
      .onSet(value => {
        platform.mqttClient?.publish(
          commandTopic,
          JSON.stringify({
            on_off: value ? 1 : 0,
          }),
        );

        platform.log.info(
          `${name} -> ${value ? 'AAN' : 'UIT'} via MQTT`,
        );
      });
  }
}
