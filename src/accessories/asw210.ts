import { PlatformAccessory } from 'homebridge';
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

  service.updateCharacteristic(
    platform.api.hap.Characteristic.On,
    Boolean(data.on_off),
  );

service
  .getCharacteristic(platform.api.hap.Characteristic.On)
  .onSet(async value => {
    const topic =
      `${platform.config.commandPrefix ?? 'bewave/command'}/devices/${index}/rx`;

    platform.log.info(
      `${name} -> ${value ? 'AAN' : 'UIT'} via MQTT`,
    );

    platform.mqttClient?.publish(
      topic,
      JSON.stringify({
        on_off: value ? 1 : 0,
      }),
    );
  });
  
}
