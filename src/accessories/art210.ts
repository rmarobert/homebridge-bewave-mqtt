import { BeWaveMqttPlatform } from '../platform';
import { PLUGIN_NAME, PLATFORM_NAME } from '../settings';

export function setupArt210Accessory(
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
      accessory.context.deviceType = 'ART_210';

      platform.api.registerPlatformAccessories(
        PLUGIN_NAME,
        PLATFORM_NAME,
        [accessory],
      );

      platform.log.info(`HomeKit thermostaat aangemaakt: ${name}`);
    }

    platform.deviceAccessories.set(index, accessory);
  }

  const thermostatService =
    accessory.getService(platform.api.hap.Service.Thermostat) ||
    accessory.addService(
      platform.api.hap.Service.Thermostat,
      name,
      'thermostat',
    );

  thermostatService.setPrimaryService();

const boostService =
  accessory.getServiceById(
    platform.api.hap.Service.Switch,
    'boost',
  ) ||
  accessory.addService(
    platform.api.hap.Service.Switch,
    `${name} Boost`,
    'boost',
  );

boostService
  .getCharacteristic(platform.api.hap.Characteristic.ConfiguredName)
  .updateValue('Boost');

const parentalControlService =
  accessory.getServiceById(
    platform.api.hap.Service.Switch,
    'parental-control',
  ) ||
  accessory.addService(
    platform.api.hap.Service.Switch,
    `${name} Kinderslot`,
    'parental-control',
  );

parentalControlService
  .getCharacteristic(platform.api.hap.Characteristic.ConfiguredName)
  .updateValue('Kinderslot');
  // ART-210 kan alleen verwarmen.
  thermostatService
    .getCharacteristic(
      platform.api.hap.Characteristic.TargetHeatingCoolingState,
    )
    .setProps({
      validValues: [
        platform.api.hap.Characteristic.TargetHeatingCoolingState.HEAT,
      ],
    })
    .updateValue(
      platform.api.hap.Characteristic.TargetHeatingCoolingState.HEAT,
    );

  thermostatService.updateCharacteristic(
    platform.api.hap.Characteristic.TemperatureDisplayUnits,
    platform.api.hap.Characteristic.TemperatureDisplayUnits.CELSIUS,
  );

  // Actuele temperatuur
  if ('temperature' in data) {
    thermostatService.updateCharacteristic(
      platform.api.hap.Characteristic.CurrentTemperature,
      Number(data.temperature),
    );
  }

  // Actieve/doeltemperatuur
  if ('heater_forced_value' in data) {
    thermostatService.updateCharacteristic(
      platform.api.hap.Characteristic.TargetTemperature,
      Number(data.heater_forced_value),
    );
  }

  // Verwarmingsstatus
  if ('valve_opening' in data) {
    const valveOpening = Number(data.valve_opening);

    accessory.context.valveOpening = valveOpening;

    thermostatService.updateCharacteristic(
      platform.api.hap.Characteristic.CurrentHeatingCoolingState,
      valveOpening > 0
        ? platform.api.hap.Characteristic.CurrentHeatingCoolingState.HEAT
        : platform.api.hap.Characteristic.CurrentHeatingCoolingState.OFF,
    );
  }

  // Werkmodus
  if ('heater_working_mode' in data) {
    const mode = Number(data.heater_working_mode);

    accessory.context.heaterWorkingMode = mode;

    const modeName =
      mode === 0 ? 'handmatig' :
      mode === 1 ? 'schema' :
      mode === 2 ? 'eco' :
      mode === 3 ? 'direct' :
      `onbekend (${mode})`;

    accessory.context.heaterWorkingModeName = modeName;

    platform.log.debug(
      `${name} modus: ${modeName}`,
    );
  }

  // Temperatuurprofielen opslaan
  if ('heater_temperature_for_day' in data) {
    accessory.context.temperatureDay =
      Number(data.heater_temperature_for_day);
  }

  if ('heater_temperature_for_night' in data) {
    accessory.context.temperatureNight =
      Number(data.heater_temperature_for_night);
  }

  if ('heater_temperature_for_eco' in data) {
    accessory.context.temperatureEco =
      Number(data.heater_temperature_for_eco);
  }

  if ('heater_temperature_for_manual' in data) {
    accessory.context.temperatureManual =
      Number(data.heater_temperature_for_manual);
  }

  if ('heater_forced_value' in data) {
    accessory.context.temperatureForced =
      Number(data.heater_forced_value);
  }

  // Boost
  if ('heater_boost' in data) {
    boostService.updateCharacteristic(
      platform.api.hap.Characteristic.On,
      Number(data.heater_boost) === 1,
    );
  }

  if ('heater_boost_time' in data) {
    accessory.context.boostTime =
      Number(data.heater_boost_time);
  }

  // Kinderslot
  if ('heater_parental_control' in data) {
    parentalControlService.updateCharacteristic(
      platform.api.hap.Characteristic.On,
      Number(data.heater_parental_control) === 1,
    );
  }

  if (!platform.boundDevices.has(index)) {
    platform.boundDevices.add(index);

    const commandTopic =
      `${platform.config.commandPrefix || 'bewave/command'}/devices/${index}/rx`;

    // Doeltemperatuur wijzigen
    thermostatService
      .getCharacteristic(
        platform.api.hap.Characteristic.TargetTemperature,
      )
      .onSet(value => {
        const temperature = Number(value);

        platform.mqttClient?.publish(
          commandTopic,
          JSON.stringify({
            heater_forced_value: temperature,
          }),
        );

        platform.log.info(
          `${name} -> doeltemperatuur ${temperature}°C via MQTT`,
        );
      });

    // Boost aan/uit
    boostService
      .getCharacteristic(platform.api.hap.Characteristic.On)
      .onSet(value => {
        platform.mqttClient?.publish(
          commandTopic,
          JSON.stringify({
            heater_boost: value ? 1 : 0,
          }),
        );

        platform.log.info(
          `${name} Boost -> ${value ? 'AAN' : 'UIT'} via MQTT`,
        );
      });

    // Kinderslot aan/uit
    parentalControlService
      .getCharacteristic(platform.api.hap.Characteristic.On)
      .onSet(value => {
        platform.mqttClient?.publish(
          commandTopic,
          JSON.stringify({
            heater_parental_control: value ? 1 : 0,
          }),
        );

        platform.log.info(
          `${name} Kinderslot -> ${value ? 'AAN' : 'UIT'} via MQTT`,
        );
      });
  }
}
