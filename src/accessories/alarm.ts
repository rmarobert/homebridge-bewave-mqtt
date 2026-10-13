
import { PlatformAccessory } from 'homebridge';
import type { BeWaveMqttPlatform } from '../platform';

type HomeMode = 'stay' | 'away' | 'night';

export interface AlarmConfig {
  enabled?: boolean;
  mapping?: Partial<Record<HomeMode, string>>;
  priority?: HomeMode[];
}

export interface DiscoveredAlarmGroup {
  name: string;
  topicName: string;
  armingStatus: string;
  alarmStatus: string;
  isDefault: boolean;
}

export class BeWaveAlarm {
  private readonly groups =
    new Map<string, DiscoveredAlarmGroup>();

  private accessory?: PlatformAccessory;
  private commandPending = false;

  // Alleen statusberichten uit de huidige MQTT-sessie vertrouwen.
  private readonly freshGroups = new Set<string>();

  constructor(
    private readonly platform: BeWaveMqttPlatform,
  ) {}

  private get mapping(): Partial<Record<HomeMode, string>> {
    return this.platform.config.alarm?.mapping ?? {};
  }

  private get priority(): HomeMode[] {
    const defaults: HomeMode[] = ['away', 'night', 'stay'];

    const configured =
      this.platform.config.alarm?.priority ?? defaults;

    return [...new Set([...configured, ...defaults])]
      .filter((mode): mode is HomeMode =>
        defaults.includes(mode),
      );
  }

  public restore(accessory: PlatformAccessory): void {
    this.accessory = accessory;
    this.setupService();
  }

  // ========================================
  // AUTOMATISCHE MQTT DISCOVERY
  // ========================================

  public process(
    topic: string,
    data: Record<string, unknown>,
  ): void {
    const match = topic.match(/\/alarms\/([^/]+)\/tx$/);

    if (!match) return;

    const topicName = match[1];
    const name = String(
      data.name ?? decodeURIComponent(topicName),
    );

    const isNew = !this.groups.has(name);

    this.freshGroups.add(name);

    this.groups.set(name, {
      name,
      topicName,
      armingStatus:
        String(data.arming_status ?? 'UNKNOWN').toUpperCase(),
      alarmStatus:
        String(data.alarm_status ?? 'UNKNOWN').toUpperCase(),
      isDefault: data.is_default === 1,
    });

    if (isNew) {
      const displayName =
        name === 'FULLARM' ? 'Volledig Beveiligen' : name;

      this.platform.log.info(
        `BE WAVE alarmgroep ontdekt: ${displayName} (${name})`,
      );
    }

    this.updateHomeKit();
  }

  public getGroups(): DiscoveredAlarmGroup[] {
    return [...this.groups.values()];
  }

  // Aanroepen bij verbindingverlies en bij een nieuwe MQTT-sessie.
  public invalidateStatus(): void {
    this.freshGroups.clear();
    this.updateHomeKit();
  }

  // ========================================
  // HOMEKIT ACCESSOIRE
  // ========================================

  private ensureAccessory(): PlatformAccessory {
    if (this.accessory) return this.accessory;

    const uuid = this.platform.api.hap.uuid.generate(
      'bewave-mqtt:alarm:primary',
    );

    const cached = this.platform.accessories.find(
      item => item.UUID === uuid,
    );

    if (cached) {
      this.restore(cached);
      return cached;
    }

    const accessory = new this.platform.api.platformAccessory(
      'BE WAVE Alarm',
      uuid,
    );

    accessory.context.bewaveAlarm = true;

    this.accessory = accessory;
    this.setupService();

    this.platform.accessories.push(accessory);

    this.platform.api.registerPlatformAccessories(
      'homebridge-bewave-mqtt',
      String(this.platform.config.platform),
      [accessory],
    );

    this.platform.log.info(
      'BE WAVE Alarm aangemaakt in Homebridge',
    );

    return accessory;
  }

  private setupService(): void {
    if (!this.accessory) return;

    const { Service, Characteristic, HapStatusError } =
      this.platform.api.hap;

    const service =
      this.accessory.getService(Service.SecuritySystem) ??
      this.accessory.addService(Service.SecuritySystem);

    service
      .getCharacteristic(Characteristic.StatusFault)
      .onGet(() =>
        this.resolveState() === undefined
          ? Characteristic.StatusFault.GENERAL_FAULT
          : Characteristic.StatusFault.NO_FAULT,
      );

    service
      .getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .onGet(() => {
        const state = this.resolveState();

        if (state === undefined) {
          throw new HapStatusError(-70402);
        }

        return state;
      });

    service
      .getCharacteristic(Characteristic.SecuritySystemTargetState)
      .onGet(() => {
        const state = this.resolveState();

        if (state === undefined) {
          throw new HapStatusError(-70402);
        }

        return this.resolveMode() ??
          Characteristic.SecuritySystemTargetState.DISARM;
      })
      .onSet(async value => {
        await this.handleTargetState(Number(value));
      });
  }

  // ========================================
  // HOMEKIT BEDIENING
  // ========================================

  private async handleTargetState(
    target: number,
  ): Promise<void> {
    const { Characteristic, HapStatusError } =
      this.platform.api.hap;

    if (this.commandPending) {
      throw new HapStatusError(-70403);
    }

    if (!this.platform.mqttClient?.connected) {
      throw new HapStatusError(-70402);
    }

    if (this.resolveState() === undefined) {
      throw new HapStatusError(-70402);
    }

    this.commandPending = true;

    try {
      const T = Characteristic.SecuritySystemTargetState;

      // UIT: volledig ingeschakelde groepen uitschakelen.
      if (target === T.DISARM) {
        await this.disarmAll();
        return;
      }

      const modes: Record<number, HomeMode> = {
        [T.STAY_ARM]: 'stay',
        [T.AWAY_ARM]: 'away',
        [T.NIGHT_ARM]: 'night',
      };

      const mode = modes[target];

      if (!mode) {
        throw new HapStatusError(-70404);
      }

      const groupName = this.mapping[mode];
      const group = groupName
        ? this.groups.get(groupName)
        : undefined;

      if (!group || !this.freshGroups.has(group.name)) {
        throw new HapStatusError(-70402);
      }

      if (
        !['ARMED', 'PARTIALLY_ARMED', 'DISARMED']
          .includes(group.armingStatus)
      ) {
        throw new HapStatusError(-70402);
      }

      // Bestaande alarmgroepen blijven ingeschakeld.
      if (group.armingStatus !== 'ARMED') {
        await this.sendCommand(group, 'ARM');
      }

      this.platform.log.info(
        `HomeKit modus ${mode}: ARM ${group.name}`,
      );
    } finally {
      this.commandPending = false;
    }
  }

  private async disarmAll(): Promise<void> {
    const { HapStatusError } = this.platform.api.hap;

    // Controleer alle ontdekte groepen, ook de
    // groepen die niet aan HomeKit zijn gekoppeld.
    const all = this.getGroups();

    // Geen uitschakelcommando op basis van oude groepsstatussen.
    if (
      !all.length ||
      all.some(group => !this.freshGroups.has(group.name))
    ) {
      throw new HapStatusError(-70402);
    }

    if (
      all.some(group =>
        !['ARMED', 'PARTIALLY_ARMED', 'DISARMED']
          .includes(group.armingStatus),
      )
    ) {
      throw new HapStatusError(-70402);
    }

    const armed = all.filter(
      group => group.armingStatus === 'ARMED',
    );

    if (!armed.length) {
      if (
        all.some(
          group => group.armingStatus === 'PARTIALLY_ARMED',
        )
      ) {
        // Onbekend welke groep verantwoordelijk is.
        throw new HapStatusError(-70404);
      }

      return;
    }

    for (const group of armed) {
      await this.sendCommand(group, 'DISARM');
    }

    this.platform.log.info(
      `HomeKit Uit: DISARM verstuurd naar ${
        armed.map(group => group.name).join(', ')
      }`,
    );
  }

  // ========================================
  // MQTT COMMANDO'S
  // ========================================

  private async sendCommand(
    group: DiscoveredAlarmGroup,
    action: 'ARM' | 'DISARM',
  ): Promise<void> {
    const client = this.platform.mqttClient;

    if (!client?.connected) {
      throw new this.platform.api.hap.HapStatusError(-70402);
    }

    const prefix =
      this.platform.config.commandPrefix ||
      'bewave/command';

    // Gebruik exact het ontdekte topicsegment.
    const topic =
      `${prefix}/alarms/${group.topicName}/rx`;

    await new Promise<void>((resolve, reject) => {
      client.publish(
        topic,
        JSON.stringify({ action }),
        { qos: 1, retain: false },
        error => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        },
      );
    });

    this.platform.log.info(
      `MQTT ${action} gepubliceerd naar ${topic}`,
    );
  }

  // ========================================
  // STATUSVERTALING
  // ========================================

  private mappedGroups(): string[] {
    return [
      ...new Set(
        Object.values(this.mapping)
          .filter((name): name is string => Boolean(name)),
      ),
    ];
  }

  private resolveMode(): number | undefined {
    const C = this.platform.api.hap.Characteristic;

    const values: Record<HomeMode, number> = {
      stay: C.SecuritySystemCurrentState.STAY_ARM,
      away: C.SecuritySystemCurrentState.AWAY_ARM,
      night: C.SecuritySystemCurrentState.NIGHT_ARM,
    };

    for (const mode of this.priority) {
      const name = this.mapping[mode];

      // PARTIALLY_ARMED telt niet als een
      // afzonderlijk volledig ingeschakelde modus.
      if (
        name &&
        this.groups.get(name)?.armingStatus === 'ARMED'
      ) {
        return values[mode];
      }
    }

    return undefined;
  }

  private resolveState(): number | undefined {
    if (!this.platform.mqttClient?.connected) {
      return undefined;
    }

    const mapped = this.mappedGroups();

    if (!mapped.length) return undefined;

    if (
      mapped.some(name =>
        !this.groups.has(name) || !this.freshGroups.has(name),
      )
    ) {
      return undefined;
    }

    for (const name of mapped) {
      const group = this.groups.get(name)!;

      if (
        !['ARMED', 'PARTIALLY_ARMED', 'DISARMED']
          .includes(group.armingStatus) ||
        !['ACTIVE', 'INACTIVE', 'WARNING_ALARM']
          .includes(group.alarmStatus)
      ) {
        return undefined;
      }

      // Een waarschuwing mag niet stilzwijgend
      // worden weergegeven als een veilige status.
      if (group.alarmStatus === 'WARNING_ALARM') {
        return undefined;
      }
    }

    const C = this.platform.api.hap.Characteristic;

    if (
      mapped.some(
        name => this.groups.get(name)?.alarmStatus === 'ACTIVE',
      )
    ) {
      return C.SecuritySystemCurrentState.ALARM_TRIGGERED;
    }

    const mode = this.resolveMode();

    if (mode !== undefined) return mode;

    // Alleen volledig uitgeschakeld tonen als
    // alle geselecteerde groepen uitgeschakeld zijn.
    if (
      mapped.every(
        name =>
          this.groups.get(name)?.armingStatus === 'DISARMED',
      )
    ) {
      return C.SecuritySystemCurrentState.DISARMED;
    }

    return undefined;
  }

  private updateHomeKit(): void {
    if (!this.platform.config.alarm?.enabled) return;
    if (!this.mappedGroups().length) return;

    const state = this.resolveState();

    const accessory = this.ensureAccessory();
    const { Service, Characteristic } = this.platform.api.hap;

    const service = accessory.getService(
      Service.SecuritySystem,
    )!;

    service.updateCharacteristic(
      Characteristic.StatusFault,
      state === undefined
        ? Characteristic.StatusFault.GENERAL_FAULT
        : Characteristic.StatusFault.NO_FAULT,
    );

    if (state === undefined) return;

    service.updateCharacteristic(
      Characteristic.SecuritySystemCurrentState,
      state,
    );

    const target =
      this.resolveMode() ??
      Characteristic.SecuritySystemTargetState.DISARM;

    service.updateCharacteristic(
      Characteristic.SecuritySystemTargetState,
      target,
    );
  }
}
