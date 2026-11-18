import { BeWaveMqttPlatform } from '../platform';
import { PLUGIN_NAME, PLATFORM_NAME } from '../settings';

export function setupAsw210Accessory(
  platform: BeWaveMqttPlatform,
  index: string,
  name: string,
  data: any,
) {
  const uuid = platform.api.hap.uuid.generate(`bewave-device-${index}`);

  let accessory =
    platform.deviceAccessories.get(index) ||
    platform.accessories.find(a => a.UUID === uuid);

  if (!accessory) {
    accessory = new platform.api.platformAccessory(name, uuid);

    accessory.context.deviceIndex = index;
    accessory.context.deviceType = data.type;

    platform.api.registerPlatformAccessories(
      PLUGIN_NAME,
      PLATFORM_NAME,
      [accessory],
    );

    platform.accessories.push(accessory);
  }

  platform.deviceAccessories.set(index, accessory);

  const service =
    accessory.getService(platform.api.hap.Service.Switch) ||
    accessory.addService(platform.api.hap.Service.Switch);

  if ('on_off' in data) {
    service.updateCharacteristic(
      platform.api.hap.Characteristic.On,
      Number(data.on_off) === 1,
    );
  }

  // MQTT state frames may arrive many times; bind HomeKit only once.
  if (!platform.boundDevices.has(index)) {
    platform.boundDevices.add(index);
    service.getCharacteristic(platform.api.hap.Characteristic.On)
      .onSet(async value => {
        const topic =
          `${platform.config.commandPrefix ?? 'bewave/command'}/devices/${index}/rx`;
        await platform.sendCommand(topic, { on_off: value ? 1 : 0 });
      });
  }

}

