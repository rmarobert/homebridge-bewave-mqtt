import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
} from 'homebridge';

import mqtt, { MqttClient } from 'mqtt';

// ================================
// Importeer alle devices 
// ================================

import { setupAsw210Accessory } from './accessories/asw210';
import { setupAdc200Accessory } from './accessories/adc200';
import { setupApd200Accessory } from './accessories/apd200';
import { setupApcam200Accessory } from './accessories/apcam200';
import { setupAtph200Accessory } from './accessories/atph200';
import { setupAxd200lAccessory } from './accessories/axd200l';
import { setupAxd200Accessory } from './accessories/axd200';
import { setupSlimPirLunaAccessory } from './accessories/slimpirluna';
import { setupArt210Accessory } from './accessories/art210';
import { setupAcmd200Accessory } from './accessories/acmd200';
import { setupAsw200eAccessory } from './accessories/asw200e';
import { setupAsd200Accessory } from './accessories/asd200';
import { setupVirtualOutputAccessory } from './accessories/virtualoutput';
import { setupVirtualIpAccessory } from './accessories/virtualip';
import { updateDeviceInformation } from './accessories/deviceinfo';

// ================================
// Importeer de scenes
// ================================

import { setupSceneAccessory } from './accessories/scene';

// ================================
// Importeer de beveiligingsmodi
// ================================

import { BeWaveAlarm } from './accessories/alarm';
import type { AlarmConfig } from './accessories/alarm';

interface BeWaveConfig extends PlatformConfig {
  brokerUrl?: string;
  username?: string;
  password?: string;
  statusPrefix?: string;
  commandPrefix?: string;
  devices?: Array<{
    id: number;
    name?: string;
    enabled?: boolean;
  }>;
  alarm?: AlarmConfig;
}

export class BeWaveMqttPlatform implements DynamicPlatformPlugin {
  public readonly accessories: PlatformAccessory[] = [];
  public mqttClient?: MqttClient;
  public readonly discoveredDevices = new Set<string>();
  public readonly deviceAccessories = new Map<string, PlatformAccessory>();
  public readonly boundDevices = new Set<string>();
  public readonly sceneAccessories = new Map<string, PlatformAccessory>();
  public readonly boundScenes = new Set<string>();
  public readonly alarm = new BeWaveAlarm(this);

  constructor(
    public readonly log: Logger,
    public readonly config: BeWaveConfig,
    public readonly api: API,
  ) {
    this.api.on('didFinishLaunching', () => {
      this.log.info('BE WAVE MQTT platform gestart');
      this.restoreCachedAccessories();
      this.connectMqtt();
    });
  }

configureAccessory(accessory: PlatformAccessory): void {
  this.log.info(`Cached accessoire gevonden: ${accessory.displayName}`);
  this.accessories.push(accessory);

if (accessory.context.bewaveAlarm) {
  if (this.config.alarm?.enabled) {
    this.alarm.restore(accessory);
  }
  return;
}

  const index = accessory.context.deviceIndex;

  if (index !== undefined) {
    this.deviceAccessories.set(String(index), accessory);
  }
}

private restoreCachedAccessories(): void {
  for (const accessory of this.accessories) {
    const index = String(accessory.context.deviceIndex ?? '');
    const type = String(accessory.context.deviceType ?? '');

    if (!index) {
      continue;
    }

    // Gebruik de ingestelde HomeKit-naam uit de configuratie.

    const configuredDevice = this.config.devices?.find(
      device => String(device.id) === index,
    );

    const configuredName = configuredDevice?.name?.trim();

    if (configuredName && configuredName !== accessory.displayName) {
      this.log.info(
        `Accessoire hernoemen: ${accessory.displayName} → ${configuredName}`,
      );

      accessory.displayName = configuredName;

      const informationService = accessory.getService(
        this.api.hap.Service.AccessoryInformation,
      );

      informationService?.updateCharacteristic(
        this.api.hap.Characteristic.Name,
        configuredName,
      );

      this.api.updatePlatformAccessories([accessory]);
    }

    if (type === 'ADC_200') {
      this.log.info(
        `Cached dimmer herstellen: ${accessory.displayName} (device ${index})`,
      );

      setupAdc200Accessory(
	this,
        index,
        accessory.displayName,
        {},
      );
    }

    if (type === 'ASW_210') {
      this.log.info(
        `Cached schakelaar herstellen: ${accessory.displayName} (device ${index})`,
      );

      setupAsw210Accessory(
	this,
        index,
        accessory.displayName,
        {},
      );
    }

    if (type === 'APD_200') {
      this.log.info(
       `Cached bewegingssensor herstellen: ${accessory.displayName} (device ${index})`,
     );

	setupApd200Accessory(
    this,
    index,
    accessory.displayName,
    {},
     );
}
if (type === 'ATPH_200') {
  this.log.info(
    `Cached klimaatsensor herstellen: ${accessory.displayName} (device ${index})`,
  );

  setupAtph200Accessory(
    this,
    index,
    accessory.displayName,
    {},
  );
}
if (type === 'AXD_200L') {
  this.log.info(
    `Cached contactsensor herstellen: ${accessory.displayName} (device ${index})`,
  );

  setupAxd200lAccessory(
    this,
    index,
    accessory.displayName,
    {},
  );
}
if (type === 'AXD_200') {
  this.log.info(
    `Cached contactsensor herstellen: ${accessory.displayName} (device ${index})`,
  );

  setupAxd200Accessory(
    this,
    index,
    accessory.displayName,
    {},
  );
}
if (type === 'SLIM_PIR_LUNA_PET_BUS') {
  this.log.info(
    `Cached BUS PIR herstellen: ${accessory.displayName} (device ${index})`,
  );

  setupSlimPirLunaAccessory(
    this,
    index,
    accessory.displayName,
    {},
  );
}
if (type === 'ART_210') {
  this.log.info(
    `Cached thermostaat herstellen: ${accessory.displayName} (device ${index})`,
  );

  setupArt210Accessory(
    this,
    index,
    accessory.displayName,
    {},
  );
} 
if (type === 'ACMD_200') {
  this.log.info(
    `Cached CO-melder herstellen: ${accessory.displayName} (device ${index})`,
  );

  setupAcmd200Accessory(
    this,
    index,
    accessory.displayName,
    {},
  );
}
if (type === 'ASW_200_E') {
  this.log.info(
    `Cached schakelaar herstellen: ${accessory.displayName} (device ${index})`,
  );

  setupAsw200eAccessory(
    this,
    index,
    accessory.displayName,
    {},
  );
}  
if (type === 'ASD_200') {
  this.log.info(
    `Cached rookmelder herstellen: ${accessory.displayName} (device ${index})`,
  );

  setupAsd200Accessory(
    this,
    index,
    accessory.displayName,
    {},
  );
}   
if (type === 'VIRTUAL_OUTPUT_DEVICE') {
  this.log.info(
    `Cached virtuele uitgang herstellen: ${accessory.displayName} (device ${index})`,
  );

  setupVirtualOutputAccessory(
    this,
    index,
    accessory.displayName,
    {},
  );
}
if (type === 'VIRTUAL_IP_DEVICE') {
  this.log.info(
    `Cached virtueel IP-device herstellen: ${accessory.displayName} (device ${index})`,
  );

  setupVirtualIpAccessory(
    this,
    index,
    accessory.displayName,
    {},
  );
}

  }
}

  private connectMqtt(): void {
    const brokerUrl = this.config.brokerUrl;

    if (!brokerUrl) {
      this.log.error('Geen MQTT brokerUrl geconfigureerd');
      return;
    }

    const statusPrefix = this.config.statusPrefix || 'bewave/status';
    const commandPrefix = this.config.commandPrefix || 'bewave/command';

    this.log.info(`Verbinden met MQTT broker: ${brokerUrl}`);

    this.mqttClient = mqtt.connect(brokerUrl, {
      username: this.config.username,
      password: this.config.password,
    });

    this.mqttClient.on('connect', () => {
      this.log.info('MQTT verbonden');

      const topics = [
        `${statusPrefix}/system/tx`,
        `${statusPrefix}/devices/+/tx`,
        `${statusPrefix}/alarms/+/tx`,
        `${statusPrefix}/scenes/+/tx`,
      ];

      for (const topic of topics) {
        this.mqttClient?.subscribe(topic, err => {
          if (err) {
            this.log.error(`Subscribe mislukt: ${topic}`);
          } else {
            this.log.info(`Subscribed: ${topic}`);
          }
        });
      }

      const syncTopic = `${commandPrefix}/system/rx`;

      this.mqttClient?.publish(
        syncTopic,
        JSON.stringify({ action: 'SYNC' }),
      );

      this.log.info(`SYNC verstuurd naar ${syncTopic}`);
    });


this.mqttClient.on('message', (topic, payload) => {
  const message = payload.toString();

  this.log.debug(`MQTT RX ${topic}: ${message}`);

  try {
    const data = JSON.parse(message);

    if (topic.includes('/scenes/')) {
      const sceneMatch = topic.match(
        /\/scenes\/([^/]+)\/tx$/,
      );

      if (sceneMatch) {
        const sceneId = sceneMatch[1];

        const sceneName =
          data.name !== undefined
            ? String(data.name)
            : sceneId;

        setupSceneAccessory(
          this,
          sceneId,
          sceneName,
        );
      }

      return;
    }

    if (topic.includes('/alarms/')) {
    this.alarm.process(topic, data);
    return;
    }

    if (topic.includes('/devices/')) {
      this.handleDeviceMessage(topic, data);
    }
  } catch {
    this.log.warn(`Ongeldige JSON ontvangen op ${topic}`);
  }
});

    this.mqttClient.on('error', error => {
      this.log.error(`MQTT fout: ${error.message}`);
    });
}  

private handleDeviceMessage(
  topic: string,
  data: Record<string, unknown>,
): void {
  const match = topic.match(/\/devices\/(\d+)\/tx$/);

  if (!match) {
    return;
  }

  const index = match[1];
  const type = String(data.type ?? 'unknown');

  // Alleen geldige device-configuraties meenemen
  const configuredDevices = (this.config.devices ?? []).filter(
    device => device.id !== undefined && device.id !== null,
  );

  // Kijk of dit specifieke device in de Homebridge-config staat
  const configuredDevice = configuredDevices.find(
    device => String(device.id) === index,
  );

  // Controleer of dit apparaat al geregistreerd is.
  const alreadyRegistered = this.deviceAccessories.has(index);

  // Bestaande accessoires behouden en blijven bijwerken.
  // Nieuwe apparaten uitsluitend toevoegen na expliciete selectie.
  if (!alreadyRegistered && configuredDevice?.enabled !== true) {
    this.log.debug(
      `Nieuw BE WAVE apparaat ${index} niet geselecteerd voor HomeKit`,
    );
    return;
  }

  // Naam uit Homebridge-config heeft voorrang op de naam uit Be Wave
  const name =
    configuredDevice?.name?.trim() ||
    String(data.name ?? `Be Wave ${index}`);

  if (!this.discoveredDevices.has(index)) {
    this.discoveredDevices.add(index);

    const capabilities: string[] = [];

    if ('on_off' in data) capabilities.push('switch');
    if ('motion' in data) capabilities.push('motion');
    if ('magnetic' in data) capabilities.push('contact');
    if ('temperature' in data) capabilities.push('temperature');
    if ('humidity' in data) capabilities.push('humidity');
    if ('pressure' in data) capabilities.push('pressure');
    if ('smoke' in data) capabilities.push('smoke');
    if ('gas' in data) capabilities.push('gas');
    if ('flood' in data) capabilities.push('flood');
    if ('glass_break' in data) capabilities.push('glass-break');
    if ('shutter_value' in data) capabilities.push('shutter');
    if ('heater_working_mode' in data) capabilities.push('thermostat');
    if ('valve_opening' in data) capabilities.push('valve');

    this.log.info(
      `Device ${index}: ${name} | type=${type} | ${
        capabilities.join(', ') || 'geen HomeKit capability'
      }`,
    );
  }

  if (type === 'ASW_210') {
   setupAsw210Accessory(this, index, name, data);
  } else if (type === 'ADC_200') {
    setupAdc200Accessory(this,index, name, data);
  } else if (type === 'APD_200') {
  setupApd200Accessory(this, index, name, data);
  } else if (type === 'APCAM_200') {
  setupApcam200Accessory(this, index, name, data);
  } else if (type === 'ATPH_200') {
  setupAtph200Accessory(this, index, name, data);
  } else if (type === 'AXD_200L') {
  setupAxd200lAccessory(this, index, name, data);
  } else if (type === 'AXD_200') {
  setupAxd200Accessory(this, index, name, data);
  } else if (type === 'SLIM_PIR_LUNA_PET_BUS') {
  setupSlimPirLunaAccessory(this, index, name, data);
  } else if (type === 'ART_210') {
  setupArt210Accessory(this, index, name, data);
  } else if (type === 'ACMD_200') {
  setupAcmd200Accessory(this, index, name, data);
  } else if (type === 'ASW_200_E') {
  setupAsw200eAccessory(this, index, name, data);
  } else if (type === 'ASD_200') {
  setupAsd200Accessory(this, index, name, data);
  } else if (type === 'VIRTUAL_OUTPUT_DEVICE') {
  setupVirtualOutputAccessory(this, index, name, data);
  } else if (type === 'VIRTUAL_IP_DEVICE') {
  setupVirtualIpAccessory(this, index, name, data);
  }

const accessory = this.deviceAccessories.get(index);

if (accessory) {
  updateDeviceInformation(
    this,
    accessory,
    type,
    data,
  );
}
 }
}
