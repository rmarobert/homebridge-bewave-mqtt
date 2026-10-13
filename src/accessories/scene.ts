import { BeWaveMqttPlatform } from '../platform';
import { PLUGIN_NAME, PLATFORM_NAME } from '../settings';

export function setupSceneAccessory(
  platform: BeWaveMqttPlatform,
  sceneId: string,
  name: string,
): void {
  let accessory = platform.sceneAccessories.get(sceneId);

  const uuid = platform.api.hap.uuid.generate(
    `bewave-mqtt-scene-${sceneId}`,
  );

  if (!accessory) {
    accessory = platform.accessories.find(a => a.UUID === uuid);

    if (!accessory) {
      accessory = new platform.api.platformAccessory(name, uuid);

      accessory.context.sceneId = sceneId;
      accessory.context.deviceType = 'BEWAVE_SCENE';

      platform.api.registerPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        [accessory],
      );

      platform.log.info(`HomeKit scene aangemaakt: ${name}`);
    }

    platform.sceneAccessories.set(sceneId, accessory);
  }

const informationService =
  accessory.getService(platform.api.hap.Service.AccessoryInformation);

informationService
  ?.setCharacteristic(
    platform.api.hap.Characteristic.Manufacturer,
    'SATEL',
  )
  .setCharacteristic(
    platform.api.hap.Characteristic.Model,
    'BE WAVE SCENE',
  )
  .setCharacteristic(
    platform.api.hap.Characteristic.SerialNumber,
    `scene-${sceneId}`,
  );

  const switchService =
    accessory.getService(platform.api.hap.Service.Switch) ||
    accessory.addService(
      platform.api.hap.Service.Switch,
      name,
      'scene',
    );

  switchService.setPrimaryService();

  // Scene staat normaal altijd "uit".
  switchService.updateCharacteristic(
    platform.api.hap.Characteristic.On,
    false,
  );

  if (!platform.boundScenes.has(sceneId)) {
    platform.boundScenes.add(sceneId);

    const commandTopic =
      `${platform.config.commandPrefix || 'bewave/command'}/scenes/${sceneId}/rx`;

    switchService
      .getCharacteristic(platform.api.hap.Characteristic.On)
      .onSet(value => {
        if (!value) {
          return;
        }

        platform.mqttClient?.publish(
          commandTopic,
          JSON.stringify({ action: 'START' }),
        );

        platform.log.info(
          `Scene ${name} gestart via MQTT`,
        );

        setTimeout(() => {
          switchService.updateCharacteristic(
            platform.api.hap.Characteristic.On,
            false,
          );
        }, 500);
      });
  }
}
