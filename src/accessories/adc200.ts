import { BeWaveMqttPlatform } from '../platform';
import { PLUGIN_NAME, PLATFORM_NAME } from '../settings';

export function setupAdc200Accessory(
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
      accessory.context.deviceType = 'ADC_200';

      platform.api.registerPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        [accessory],
      );

      platform.log.info(`HomeKit dimmer aangemaakt: ${name}`);
    }

    platform.deviceAccessories.set(index, accessory);
  }

  const service =
    accessory.getService(platform.api.hap.Service.Lightbulb) ||
    accessory.addService(platform.api.hap.Service.Lightbulb, name);

  if ('on_off' in data) {
    service.updateCharacteristic(
      platform.api.hap.Characteristic.On,
      Number(data.on_off) === 1,
    );
  }

  if ('color_brightening_value' in data) {
    service.updateCharacteristic(
      platform.api.hap.Characteristic.Brightness,
      Number(data.color_brightening_value),
    );
  }

  if (platform.boundDevices.has(index)) {
    return;
  }

  platform.boundDevices.add(index);

  service
    .getCharacteristic(platform.api.hap.Characteristic.On)
    .onSet(async value => {
      const commandTopic =
        `${platform.config.commandPrefix || 'bewave/command'}/devices/${index}/rx`;

      platform.mqttClient?.publish(
        commandTopic,
        JSON.stringify({ on_off: value ? 1 : 0 }),
      );
    });

  service
    .getCharacteristic(platform.api.hap.Characteristic.Brightness)
    .onSet(async value => {
      const brightness = Math.round(Number(value));

      const commandTopic =
        `${platform.config.commandPrefix || 'bewave/command'}/devices/${index}/rx`;
	platform.log.info(
	  `${name} -> helderheid ${brightness}% via MQTT`,
	);

      platform.mqttClient?.publish(
        commandTopic,
        JSON.stringify({
          color_brightening_value: brightness,
        }),
      );
    });
}
