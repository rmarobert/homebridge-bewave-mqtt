const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const vm = require('node:vm');
const { HubMonitor } = require('../dist/hub-monitor');
const { publishCommand } = require('../dist/publish-command');

class Client extends EventEmitter {
  connected = true;
  sent = [];
  publish(topic, payload, options, callback) {
    this.sent.push({ topic, payload: JSON.parse(payload), options });
    this.callback = callback;
    if (this.complete) callback();
  }
  subscribe(topics, options, callback) {
    const acknowledge = () => callback(null, topics.map(topic => ({ topic, qos: 0 })));
    if (this.deferSubscriptions) this.subscriptions.push(acknowledge);
    else acknowledge();
  }
  end() { this.connected = false; }
}

function platformFixture({ deferSubscriptions = false } = {}) {
  const client = new Client();
  client.complete = true;
  client.deferSubscriptions = deferSubscriptions;
  client.subscriptions = [];
  const filename = path.resolve(__dirname, '../dist/platform.js');
  const originalRequire = createRequire(filename);
  const module = { exports: {} };
  const api = new EventEmitter();
  class HapStatusError extends Error {
    constructor(status) { super(String(status)); this.hapStatus = status; }
  }
  api.hap = {
    HapStatusError,
    Characteristic: {
      SecuritySystemCurrentState: {
        STAY_ARM: 0, AWAY_ARM: 1, NIGHT_ARM: 2,
        DISARMED: 3, ALARM_TRIGGERED: 4,
      },
      SecuritySystemTargetState: {
        STAY_ARM: 0, AWAY_ARM: 1, NIGHT_ARM: 2, DISARM: 3,
      },
    },
  };
  let options;
  vm.runInNewContext(readFileSync(filename, 'utf8'), {
    module, exports: module.exports,
    require: name => name === 'mqtt' ? {
      connect: (url, opts) => { options = opts; return client; },
    } : originalRequire(name),
    setTimeout, clearTimeout, setInterval, clearInterval,
  }, { filename });
  const log = { info() {}, warn() {}, error() {}, debug() {} };
  const config = {
    platform: 'BeWaveMQTT', brokerUrl: 'mqtt://example',
    // Disable accessory creation; inspect the same state resolver as HomeKit.
    alarm: { enabled: false, mapping: { away: 'FULLARM' } },
  };
  const platform = new module.exports.BeWaveMqttPlatform(log, config, api);
  api.emit('didFinishLaunching');
  client.emit('connect');
  const receive = (suffix, data, retain = false) => client.emit(
    'message', `bewave/status/${suffix}/tx`,
    Buffer.from(JSON.stringify(data)), { retain },
  );
  return { platform, client, api, receive, options };
}

const hub = { type: 'hub', mac: '00:11:22:33:44:55' };
const armed = {
  name: 'FULLARM', arming_status: 'ARMED', alarm_status: 'INACTIVE',
};

test('retained and malformed hub replies cannot establish availability', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  let probes = 0;
  const changes = [];
  const monitor = new HubMonitor(() => probes++, value => changes.push(value));
  monitor.start();
  assert.equal(probes, 1);
  monitor.receive(hub, true);
  monitor.receive({ type: 'hub' }, false);
  assert.equal(monitor.online, false);
  monitor.receive(hub, false);
  assert.equal(monitor.online, true);
  t.mock.timers.tick(60_000);
  assert.equal(probes, 2);
  t.mock.timers.tick(15_000);
  assert.equal(monitor.online, false);
  assert.deepEqual(changes, [true, false]);
  // Replies outside a pending probe cannot restore availability.
  monitor.receive(hub, false);
  assert.equal(monitor.online, false);
  t.mock.timers.tick(45_000);
  monitor.receive(hub, false);
  assert.equal(monitor.online, true);
  monitor.stop();
  t.mock.timers.tick(120_000);
  assert.equal(probes, 3);
  assert.equal(monitor.online, false);
});

test('retained alarm snapshots do not restore trusted status after reconnect', t => {
  const f = platformFixture();
  t.after(() => f.api.emit('shutdown'));
  assert.equal(f.options.queueQoSZero, false);
  f.receive('alarms/FULLARM', armed, true);
  f.receive('system', hub);
  assert.equal(f.platform.alarm.resolveState(), undefined);
  f.receive('alarms/FULLARM', armed);
  assert.equal(f.platform.alarm.resolveState(), 1);
  f.client.connected = false;
  f.client.emit('close');
  assert.equal(f.platform.alarm.resolveState(), undefined);
  f.client.connected = true;
  f.client.emit('connect');
  f.receive('alarms/FULLARM', armed, true);
  f.receive('system', hub);
  assert.equal(f.platform.alarm.resolveState(), undefined);
  f.receive('alarms/FULLARM', armed);
  assert.equal(f.platform.alarm.resolveState(), 1);
});

test('hub loss invalidates groups while broker remains connected; live SYNC restores them', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const f = platformFixture();
  t.after(() => f.api.emit('shutdown'));
  f.receive('system', hub);
  f.receive('alarms/FULLARM', armed);
  assert.equal(f.platform.alarm.resolveState(), 1);
  t.mock.timers.tick(60_000);
  t.mock.timers.tick(15_000);
  assert.equal(f.client.connected, true);
  assert.equal(f.platform.alarm.resolveState(), undefined);
  assert.equal(f.platform.alarm.getGroups().length, 1);
  t.mock.timers.tick(45_000);
  f.receive('system', hub);
  assert.equal(f.platform.alarm.resolveState(), undefined);
  f.receive('alarms/FULLARM', armed);
  assert.equal(f.platform.alarm.resolveState(), 1);
});

test('platform rejects control commands until the hub has a live response', async t => {
  const f = platformFixture();
  t.after(() => f.api.emit('shutdown'));
  const topic = 'bewave/command/devices/1/rx';
  const before = f.client.sent.length;
  await assert.rejects(f.platform.sendCommand(topic, { on_off: 1 }),
    error => error.hapStatus === -70402);
  assert.equal(f.client.sent.length, before);
  f.receive('system', hub);
  await f.platform.sendCommand(topic, { on_off: 1 });
  assert.equal(f.client.sent.at(-1).topic, topic);
});

test('an old subscription callback cannot start probes in a newer MQTT session', t => {
  const f = platformFixture({ deferSubscriptions: true });
  t.after(() => f.api.emit('shutdown'));
  assert.equal(f.client.sent.length, 0);
  f.client.connected = false;
  f.client.emit('close');
  f.client.connected = true;
  f.client.emit('connect');
  f.client.subscriptions[0]();
  assert.equal(f.client.sent.length, 0);
  f.receive('system', hub);
  assert.equal(f.platform.hubMonitor.online, false);
  f.client.subscriptions[1]();
  assert.equal(f.client.sent.length, 1);
  f.receive('system', hub);
  assert.equal(f.platform.hubMonitor.online, true);
});

test('platform translates failed writes into a HomeKit communication error', async t => {
  const f = platformFixture();
  t.after(() => f.api.emit('shutdown'));
  f.receive('system', hub);
  f.client.complete = false;
  const result = f.platform.sendCommand('bewave/command/devices/1/rx', { on_off: 1 });
  const rejected = assert.rejects(result, error => error.hapStatus === -70402);
  f.client.callback(new Error('write failed'));
  await rejected;
});

test('a HomeKit switch setter waits for publishing and propagates its failure', async () => {
  const { setupAsw200eAccessory } = require('../dist/accessories/asw200e');
  let setter;
  const service = {
    setPrimaryService() {},
    getCharacteristic() { return { onSet(handler) { setter = handler; } }; },
  };
  let fail;
  const sending = new Promise((resolve, reject) => { fail = reject; });
  const commands = [];
  const platform = {
    api: { hap: { uuid: { generate: () => 'uuid' },
      Service: { Switch: 'switch' }, Characteristic: { On: 'on' } } },
    deviceAccessories: new Map([['1', { getService: () => service }]]),
    boundDevices: new Set(), config: {}, log: { info() {} },
    sendCommand(topic, payload) { commands.push({ topic, payload }); return sending; },
  };
  setupAsw200eAccessory(platform, '1', 'Switch', {});
  let complete = false;
  const result = setter(true).then(() => { complete = true; });
  const rejected = assert.rejects(result, /offline/);
  await Promise.resolve();
  assert.equal(complete, false);
  assert.deepEqual(commands, [{
    topic: 'bewave/command/devices/1/rx', payload: { on_off: 1 },
  }]);
  fail(new Error('offline'));
  await rejected;
  assert.equal(complete, false);
});

test('offline commands are rejected without publishing', async () => {
  await assert.rejects(publishCommand(undefined, 'topic', {}), /niet verbonden/);
  const client = new Client();
  client.connected = false;
  await assert.rejects(publishCommand(client, 'topic', {}), /niet verbonden/);
  assert.equal(client.sent.length, 0);
});

test('successful command waits for publish callback and cleans listeners', async () => {
  const client = new Client();
  let completed = false;
  const result = publishCommand(client, 'topic', { on_off: 1 })
    .then(() => { completed = true; });
  await Promise.resolve();
  assert.equal(completed, false);
  assert.deepEqual(client.sent[0], {
    topic: 'topic', payload: { on_off: 1 },
    options: { qos: 0, retain: false },
  });
  client.callback();
  await result;
  assert.equal(completed, true);
  assert.equal(client.listenerCount('close'), 0);
  assert.equal(client.listenerCount('offline'), 0);
  assert.equal(client.listenerCount('error'), 0);
});

test('publish errors, connection loss and synchronous exceptions reject the command', async () => {
  for (const event of ['close', 'offline', 'error', 'callback', 'throw']) {
    const client = new Client();
    if (event === 'throw') client.publish = () => { throw new Error('write failed'); };
    const result = publishCommand(client, 'topic', {});
    const rejected = assert.rejects(result);
    if (event === 'callback') client.callback(new Error('write failed'));
    else if (event !== 'throw') client.emit(event, new Error('write failed'));
    await rejected;
    assert.equal(client.listenerCount('close'), 0);
    assert.equal(client.listenerCount('offline'), 0);
    assert.equal(client.listenerCount('error'), 0);
    // A late completion cannot turn a failed command into a success.
    client.callback?.();
  }
});

test('unresponsive publishing has a bounded timeout', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const client = new Client();
  const result = assert.rejects(publishCommand(client, 'topic', {}, 5000), /verlopen/);
  t.mock.timers.tick(5000);
  await result;
  assert.equal(client.listenerCount('close'), 0);
});

test('shutdown cancels probes and closes the MQTT client', () => {
  const f = platformFixture();
  f.receive('system', hub);
  f.api.emit('shutdown');
  assert.equal(f.platform.hubMonitor.online, false);
  assert.equal(f.client.connected, false);
});
