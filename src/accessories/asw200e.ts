import { BeWaveMqttPlatform } from '../platform';
import { PLUGIN_NAME, PLATFORM_NAME } from '../settings';

export function setupAsw200eAccessory(
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
      accessory.context.deviceType = 'ASW_200_E';

      platform.api.registerPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        [accessory],
      );

      platform.log.info(`HomeKit schakelaar aangemaakt: ${name}`);
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

  if ('voltage_supply' in data) {
    accessory.context.voltageSupply = Number(data.voltage_supply);
  }

  if ('power' in data) {
    accessory.context.power = Number(data.power);
  }

  if ('energy' in data) {
    accessory.context.energy = Number(data.energy);
  }

  if ('signal' in data) {
    accessory.context.signal = Number(data.signal);
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
          JSON.stringify({ on_off: value ? 1 : 0 }),
        );

        platform.log.info(
          `${name} -> ${value ? 'AAN' : 'UIT'} via MQTT`,
        );
      });
  }
}
