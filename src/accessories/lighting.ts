import type { BeWaveMqttPlatform } from '../platform';
import { PLUGIN_NAME, PLATFORM_NAME } from '../settings';

function rgbToHsv(color: number): { hue: number; saturation: number } {
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const b = (color & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
  }
  return { hue: ((hue * 60) + 360) % 360, saturation: max ? delta / max * 100 : 0 };
}

function hsvToRgb(hue: number, saturation: number): number {
  const h = ((hue % 360) + 360) % 360;
  const s = Math.max(0, Math.min(1, saturation / 100));
  const x = (1 - Math.abs(((h / 60) % 2) - 1)) * s;
  const m = 1 - s;
  const parts: number[][] = [[s, x, 0], [x, s, 0], [0, s, x], [0, x, s], [x, 0, s], [s, 0, x]];
  const [r, g, b] = parts[Math.floor(h / 60)];
  return (Math.round((r + m) * 255) << 16) |
    (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255);
}

/** Generic BE WAVE lighting, using published role and fields (not a guessed model). */
export function setupLightingAccessory(
  platform: BeWaveMqttPlatform, index: string, name: string,
  data: Record<string, unknown>, deviceType: string,
): void {
  const { Service, Characteristic } = platform.api.hap;
  const uuid = platform.api.hap.uuid.generate(`bewave-mqtt-${index}`);
  let accessory = platform.deviceAccessories.get(index) ??
    platform.accessories.find(a => a.UUID === uuid);
  if (!accessory) {
    accessory = new platform.api.platformAccessory(name, uuid);
    accessory.context.deviceIndex = index;
    accessory.context.deviceType = deviceType;
    platform.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
  }
  accessory.context.deviceIndex = index;
  accessory.context.deviceType = deviceType;
  platform.deviceAccessories.set(index, accessory);

  const service = accessory.getService(Service.Lightbulb) ??
    accessory.addService(Service.Lightbulb, name, 'light');
  service.setPrimaryService();
  if ('on_off' in data) {
    service.updateCharacteristic(Characteristic.On, Number(data.on_off) === 1);
  }
  if ('color_brightening_value' in data) {
    const brightness = Number(data.color_brightening_value);
    if (Number.isFinite(brightness) && brightness >= 0 && brightness <= 100) {
      service.updateCharacteristic(Characteristic.Brightness, brightness);
    }
  }
  const role = String(data.mode_of_work ?? accessory.context.modeOfWork ?? '');
  accessory.context.modeOfWork = role;
  const colorEnabled = role === 'COLOR_RGB' || role === 'COLOR_RGBW';
  if (colorEnabled && ('color_display' in data || 'color_control' in data)) {
    const color = Number(data.color_display ?? data.color_control);
    if (Number.isInteger(color) && color >= 0 && color <= 0xFFFFFF) {
      const hsv = rgbToHsv(color);
      accessory.context.hue = hsv.hue;
      accessory.context.saturation = hsv.saturation;
      service.updateCharacteristic(Characteristic.Hue, hsv.hue);
      service.updateCharacteristic(Characteristic.Saturation, hsv.saturation);
    }
  }

  if (platform.boundDevices.has(index)) return;
  platform.boundDevices.add(index);
  const topic = `${platform.config.commandPrefix || 'bewave/command'}/devices/${index}/rx`;
  service.getCharacteristic(Characteristic.On).onSet(async value => {
    await platform.sendCommand(topic, { on_off: value ? 1 : 0 });
  });
  service.getCharacteristic(Characteristic.Brightness).onSet(async value => {
    await platform.sendCommand(topic, { color_brightening_value: Math.round(Number(value)) });
  });
  if (colorEnabled) {
    service.getCharacteristic(Characteristic.Hue).onSet(async value => {
      const hue = Number(value);
      const saturation = Number(accessory!.context.saturation ?? 100);
      await platform.sendCommand(topic, { color_control: hsvToRgb(hue, saturation) });
      accessory!.context.hue = hue;
    });
    service.getCharacteristic(Characteristic.Saturation).onSet(async value => {
      const saturation = Number(value);
      const hue = Number(accessory!.context.hue ?? 0);
      await platform.sendCommand(topic, { color_control: hsvToRgb(hue, saturation) });
      accessory!.context.saturation = saturation;
    });
  }
}
