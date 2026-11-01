import type { MqttClient } from 'mqtt';

/** Resolve after a live socket write; never queue an offline control command. */
export function publishCommand(
  client: MqttClient | undefined,
  topic: string,
  payload: Record<string, unknown>,
  timeoutMs = 5000,
): Promise<void> {
  if (!client?.connected) {
    return Promise.reject(new Error('MQTT niet verbonden'));
  }

  return new Promise<void>((resolve, reject) => {
    let finished = false;
    const finish = (error?: Error | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      client.removeListener('close', disconnected);
      client.removeListener('offline', disconnected);
      client.removeListener('error', failed);
      if (error) reject(error);
      else resolve();
    };
    const disconnected = () => finish(new Error('MQTT verbinding verloren'));
    const failed = (error: Error) => finish(error);
    const timer = setTimeout(
      () => finish(new Error('MQTT verzenden verlopen')),
      timeoutMs,
    );

    client.once('close', disconnected);
    client.once('offline', disconnected);
    client.once('error', failed);

    try {
      client.publish(topic, JSON.stringify(payload), {
        qos: 0,
        retain: false,
      }, finish);
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
