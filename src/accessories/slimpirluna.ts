import { BeWaveMqttPlatform } from '../platform';
import { PLUGIN_NAME, PLATFORM_NAME } from '../settings';

export function setupSlimPirLunaAccessory(
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
      accessory.context.deviceType = 'SLIM_PIR_LUNA_PET_BUS';

      platform.api.registerPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        [accessory],
      );

      platform.log.info(`HomeKit BUS PIR aangemaakt: ${name}`);
    }

    platform.deviceAccessories.set(index, accessory);
  }

  const motionService =
    accessory.getService(platform.api.hap.Service.MotionSensor) ||
    accessory.addService(
      platform.api.hap.Service.MotionSensor,
      `${name} beweging`,
      'motion',
    );

  motionService.setPrimaryService();

  const temperatureService =
    accessory.getService(platform.api.hap.Service.TemperatureSensor) ||
    accessory.addService(
      platform.api.hap.Service.TemperatureSensor,
      `${name} temperatuur`,
      'temperature',
    );

  const lightService =
    accessory.getServiceById(
      platform.api.hap.Service.Lightbulb,
      'luna-light',
    ) ||
    accessory.addService(
      platform.api.hap.Service.Lightbulb,
      `${name} licht`,
      'luna-light',
    );

  if ('motion' in data) {
    motionService.updateCharacteristic(
      platform.api.hap.Characteristic.MotionDetected,
      Number(data.motion) === 1,
    );
  }

  if ('temperature' in data) {
    temperatureService.updateCharacteristic(
      platform.api.hap.Characteristic.CurrentTemperature,
      Number(data.temperature),
    );
  }

  if ('on_off' in data) {
    lightService.updateCharacteristic(
      platform.api.hap.Characteristic.On,
      Number(data.on_off) === 1,
    );
  }

  if (!platform.boundDevices.has(index)) {
    platform.boundDevices.add(index);

    lightService
      .getCharacteristic(platform.api.hap.Characteristic.On)
      .onSet(value => {
        const topic =
          `${platform.config.commandPrefix || 'bewave/command'}/devices/${index}/rx`;

        platform.mqttClient?.publish(
          topic,
          JSON.stringify({ on_off: value ? 1 : 0 }),
        );

        platform.log.info(
          `${name} LUNA-licht -> ${value ? 'AAN' : 'UIT'} via MQTT`,
        );
      });
  }
}
