import { API } from 'homebridge';
import { PLUGIN_NAME, PLATFORM_NAME } from './settings';
import { BeWaveMqttPlatform } from './platform';

export default (api: API) => {
  api.registerPlatform(
    PLUGIN_NAME,
    PLATFORM_NAME,
    BeWaveMqttPlatform,
  );
};

