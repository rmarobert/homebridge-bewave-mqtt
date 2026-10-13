'use strict';

const { HomebridgePluginUiServer } =
  require('@homebridge/plugin-ui-utils');
const mqtt = require('mqtt');

class BeWaveUiServer extends HomebridgePluginUiServer {
  constructor() {
    super();

    this.onRequest('/discover', async (config) => {
      return this.discover(config, false);
    });

    this.onRequest('/sync', async (config) => {
      return this.discover(config, true);
    });

    this.onRequest('/registered-devices', async () => {
      const fs = require('node:fs/promises');
      const path = require('node:path');

      const storagePath = process.env.HOMEBRIDGE_STORAGE_PATH ||
        '/var/lib/homebridge';

      const cachePath = path.join(
        storagePath,
        'accessories',
        'cachedAccessories'
      );

      const raw = await fs.readFile(cachePath, 'utf8');
      const cached = JSON.parse(raw);

      if (!Array.isArray(cached)) {
        throw new Error('Onverwacht Homebridge-cacheformaat');
      }

      return cached
        .filter(item =>
          item.plugin === 'homebridge-bewave-mqtt' &&
          item.platform === 'BeWaveMQTT' &&
          item.context?.deviceIndex !== undefined
        )
        .map(item => ({
          id: String(item.context.deviceIndex),
          name: item.displayName,
          type: item.context.deviceType,
        }));
    });

    this.ready();
  }

  async discover(config, sendSync = false) {
    const brokerUrl = config?.brokerUrl;

    if (!brokerUrl) {
      throw new Error('Geen MQTT brokerUrl geconfigureerd');
    }

    const prefix = config.statusPrefix || 'bewave/status';
    const devices = new Map();
    const alarms = new Map();

    return new Promise((resolve, reject) => {
      const client = mqtt.connect(brokerUrl, {
        username: config.username,
        password: config.password,
        reconnectPeriod: 0,
        connectTimeout: 5000,
      });

      let finished = false;
      let connected = false;
      let timer;

      const finish = (error) => {
        if (finished) return;
        finished = true;

        clearTimeout(timer);
        client.end(true);

        if (error) {
          reject(new Error(error.message || String(error)));
        } else {
          resolve({
            connected,
            devices: [...devices.values()],
            alarms: [...alarms.values()],
          });
        }
      };

      client.on('connect', () => {
        connected = true;

        client.subscribe([
          `${prefix}/devices/+/tx`,
          `${prefix}/alarms/+/tx`,
        ], (error, granted) => {
          if (error) return finish(error);

          if (!granted || granted.length !== 2 ||
              granted.some(item => item.qos === 128)) {
            return finish(new Error('MQTT abonnement mislukt'));
          }

          if (sendSync) {
            const commandPrefix =
              config.commandPrefix || 'bewave/command';

            client.publish(
              `${commandPrefix}/system/rx`,
              JSON.stringify({ action: 'SYNC' }),
              { qos: 0, retain: false },
              (publishError) => {
                if (publishError) finish(publishError);
              }
            );
          }
        });
      });

      client.on('message', (topic, payload) => {
        try {
          const data = JSON.parse(payload.toString());

          const deviceMatch = topic.match(/\/devices\/(\d+)\/tx$/);
          const alarmMatch = topic.match(/\/alarms\/([^/]+)\/tx$/);

          if (deviceMatch) {
            const id = Number(deviceMatch[1]);

            devices.set(id, {
              id,
              name: String(data.name ?? `BE WAVE ${id}`),
              type: String(data.type ?? 'unknown'),
              capabilities: Object.keys(data),
            });
          }

          if (alarmMatch) {
            const topicName = alarmMatch[1];

            alarms.set(topicName, {
              topicName,
              name: String(data.name ?? topicName),
              armingStatus: String(
                data.arming_status ?? 'UNKNOWN'
              ),
              alarmStatus: String(
                data.alarm_status ?? 'UNKNOWN'
              ),
            });
          }
        } catch {
          // Ongeldige MQTT JSON overslaan.
        }
      });

      client.on('error', finish);

      timer = setTimeout(() => {
        if (!connected) {
          finish(new Error('MQTT verbinding verlopen'));
        } else {
          finish();
        }
      }, 8000);
    });
  }
}

new BeWaveUiServer();
