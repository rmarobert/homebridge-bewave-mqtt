const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = readFileSync(path.join(__dirname, '../homebridge-ui/public/index.html'), 'utf8');
const script = html.slice(html.indexOf('let discoveredAlarmNames = []'),
  html.indexOf('</script>', html.indexOf('let discoveredAlarmNames = []')));
const translations = JSON.parse(html.match(/const bwTranslations = (\{[^\n]+\});/)[1]);

async function fixture() {
  const elements = new Map();
  function element() {
    const classes = new Set();
    return {
      value: '', disabled: false, textContent: '', options: [], handlers: {},
      classList: { add: name => classes.add(name), remove: name => classes.delete(name),
        contains: name => classes.has(name) },
      replaceChildren() { this.options = []; },
      appendChild(option) { this.options.push(option); },
      addEventListener(name, handler) { this.handlers[name] = handler; },
    };
  }
  for (const id of ['alarmStay', 'alarmAway', 'alarmNight', 'alarmSaveStatus']) {
    elements.set(id, element());
  }
  let config = [{ platform: 'BeWaveMQTT', brokerUrl: 'mqtt://example',
    alarm: { enabled: true, priority: ['away', 'night', 'stay'],
      mapping: { stay: 'Buitenschil', away: 'FULLARM', night: 'keuken' } } }];
  let writes = 0;
  let fail = false;
  let release;
  const bridge = {
    async getPluginConfig() { return structuredClone(config); },
    async updatePluginConfig(next) {
      writes++;
      if (fail) throw new Error('opslag mislukt');
      if (release) await release;
      config = structuredClone(next);
    },
  };
  const context = vm.createContext({
    document: { getElementById: id => elements.get(id), createElement: element },
    homebridge: bridge, bwTranslate: key => translations.nl[key],
  });
  vm.runInContext(script, context);
  await context.loadAlarmMapping(['Buitenschil', 'FULLARM', 'keuken'].map(name => ({ name })));
  return {
    elements, context, config: () => config, writes: () => writes,
    fail: () => { fail = true; },
    delay: promise => { release = promise; },
    change(id, value) {
      const el = elements.get(id); el.value = value;
      return el.handlers.change();
    },
  };
}

test('duplicate selection reverts immediately before global SAVE can see it', async () => {
  const f = await fixture();
  const pending = f.change('alarmNight', 'Buitenschil');
  assert.equal(f.elements.get('alarmNight').value, 'keuken');
  assert.equal(f.elements.get('alarmStay').value, 'Buitenschil');
  assert.equal(f.writes(), 0);
  assert.match(f.elements.get('alarmSaveStatus').textContent, /Wijziging niet toegepast/);
  assert.equal(f.elements.get('alarmSaveStatus').classList.contains('text-danger'), true);
  await pending;
  assert.equal(f.config()[0].alarm.mapping.night, 'keuken');
});

test('valid change is persisted, preserving the other alarm settings', async () => {
  const f = await fixture();
  await f.change('alarmNight', '');
  assert.equal(f.writes(), 1);
  assert.deepEqual(f.config()[0].alarm.mapping, { stay: 'Buitenschil', away: 'FULLARM' });
  assert.equal(f.config()[0].alarm.enabled, true);
  assert.deepEqual(f.config()[0].alarm.priority, ['away', 'night', 'stay']);
  await f.change('alarmNight', 'Buitenschil');
  assert.equal(f.elements.get('alarmNight').value, '');
  assert.equal(f.writes(), 1);
});

test('unavailable groups and failed updates restore the previous visible values', async () => {
  const f = await fixture();
  await f.change('alarmNight', 'missing');
  assert.equal(f.elements.get('alarmNight').value, 'keuken');
  assert.equal(f.writes(), 0);
  f.fail();
  await f.change('alarmNight', '');
  assert.equal(f.elements.get('alarmNight').value, 'keuken');
  assert.equal(f.config()[0].alarm.mapping.night, 'keuken');
  assert.match(f.elements.get('alarmSaveStatus').textContent, /opslag mislukt/);
  assert.equal(f.elements.get('alarmNight').disabled, false);
});

test('selectors are disabled while a valid mapping is being staged', async () => {
  const f = await fixture();
  let done;
  f.delay(new Promise(resolve => { done = resolve; }));
  const pending = f.change('alarmNight', '');
  assert.equal(f.elements.get('alarmNight').disabled, true);
  assert.equal(f.elements.get('alarmStay').disabled, true);
  await Promise.resolve();
  done();
  await pending;
  assert.equal(f.elements.get('alarmNight').disabled, false);
  assert.equal(f.elements.get('alarmStay').disabled, false);
});
