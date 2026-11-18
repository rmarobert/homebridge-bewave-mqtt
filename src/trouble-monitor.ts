import type { PlatformAccessory } from 'homebridge';
import type { BeWaveMqttPlatform } from './platform';
import { publishCommand } from './publish-command';

/**
 * Diagnostic trouble counts are published in live hub/device state frames.
 * Text lists are obtained on demand with GET_FAULTS and never retained locally
 * as an authoritative current status across reconnects.
 */
export class TroubleMonitor {
  private hubCount = 0;
  private readonly deviceCounts = new Map<string, number>();
  private readonly lastQuery = new Map<string, number>();
  private readonly queryIntervalMs = 60_000;

  constructor(private readonly platform: BeWaveMqttPlatform) {}

  public reset(): void {
    this.lastQuery.clear();
    // Keep HomeKit devices flagged as unavailable while the hub is offline.
    this.setAllFaults(true);
  }

  public processHub(data: Record<string, unknown>, retained: boolean): void {
    if (retained) return;
    const count = this.parseCount(data.errors_count);
    if (count === undefined) return;
    if (count !== this.hubCount) {
      this.platform.log.info(`BE WAVE centrale: ${count} actieve storing(en)`);
      this.hubCount = count;
      if (count > 0) this.queryFaults();
    }
    this.refreshFaults();
  }

  public processDevice(
    index: string, data: Record<string, unknown>, retained: boolean,
  ): void {
    if (retained) return;
    const count = this.parseCount(data.errors_count);
    if (count === undefined) return;
    const previous = this.deviceCounts.get(index);
    this.deviceCounts.set(index, count);
    if (previous !== count && count > 0) this.queryFaults(index);
    const accessory = this.platform.deviceAccessories.get(index);
    if (accessory) this.setFault(accessory, count > 0 || !this.platform.hubMonitor.online);
  }

  public processFaultText(topic: string, data: Record<string, unknown>): void {
    const errors = data.errors;
    if (!Array.isArray(errors)) return;
    const messages = errors.filter((message): message is string => typeof message === 'string');
    if (messages.length) {
      // Diagnostic text may be localized. Do not treat it as an exhaustive
      // current-state source; counts in state frames remain authoritative.
      this.platform.log.warn(`BE WAVE storingen (${topic}): ${messages.join('; ')}`);
    }
  }

  public refreshFaults(): void {
    for (const [index, accessory] of this.platform.deviceAccessories) {
      this.setFault(
        accessory,
        !this.platform.hubMonitor.online || this.hubCount > 0 ||
          (this.deviceCounts.get(index) ?? 0) > 0,
      );
    }
  }

  private setAllFaults(value: boolean): void {
    for (const accessory of this.platform.deviceAccessories.values()) {
      this.setFault(accessory, value);
    }
  }

  private setFault(accessory: PlatformAccessory, value: boolean): void {
    const { Characteristic } = this.platform.api.hap;
    for (const service of accessory.services) {
      if (!service.testCharacteristic(Characteristic.StatusFault)) {
        try {
          service.getCharacteristic(Characteristic.StatusFault);
        } catch {
          continue;
        }
      }
      if (service.testCharacteristic(Characteristic.StatusFault)) {
        service.updateCharacteristic(
          Characteristic.StatusFault,
          value ? Characteristic.StatusFault.GENERAL_FAULT
            : Characteristic.StatusFault.NO_FAULT,
        );
      }
    }
  }

  private parseCount(value: unknown): number | undefined {
    const number = Number(value);
    return value !== undefined && Number.isInteger(number) && number >= 0
      ? number : undefined;
  }

  private queryFaults(index?: string): void {
    const key = index ?? 'system';
    const now = Date.now();
    if (now - (this.lastQuery.get(key) ?? -Infinity) < this.queryIntervalMs) return;
    this.lastQuery.set(key, now);
    const prefix = this.platform.config.commandPrefix || 'bewave/command';
    const topic = index ? `${prefix}/devices/${index}/rx` : `${prefix}/system/rx`;
    void publishCommand(this.platform.mqttClient, topic, { action: 'GET_FAULTS', lang: 9 })
      .catch(error => this.platform.log.debug(`GET_FAULTS niet beschikbaar: ${String(error)}`));
  }
}
