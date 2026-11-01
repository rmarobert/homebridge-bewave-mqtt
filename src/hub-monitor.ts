/** Confirm hub availability with live responses to periodic SYNC requests. */
export class HubMonitor {
  public online = false;
  private interval?: ReturnType<typeof setInterval>;
  private deadline?: ReturnType<typeof setTimeout>;
  private awaitingResponse = false;

  constructor(
    private readonly sync: () => void,
    private readonly changed: (online: boolean) => void,
    private readonly intervalMs = 60_000,
    private readonly timeoutMs = 15_000,
  ) {}

  public start(): void {
    this.stop();
    this.probe();
    this.interval = setInterval(() => this.probe(), this.intervalMs);
  }

  public stop(): void {
    clearInterval(this.interval);
    clearTimeout(this.deadline);
    this.interval = undefined;
    this.deadline = undefined;
    this.awaitingResponse = false;
    this.setOnline(false);
  }

  public receive(data: Record<string, unknown>, retained: boolean): void {
    if (!this.awaitingResponse || retained ||
        data.type !== 'hub' || typeof data.mac !== 'string' || !data.mac) {
      return;
    }

    clearTimeout(this.deadline);
    this.deadline = undefined;
    this.awaitingResponse = false;
    this.setOnline(true);
  }

  private probe(): void {
    this.awaitingResponse = true;
    this.deadline = setTimeout(() => {
      this.awaitingResponse = false;
      this.deadline = undefined;
      this.setOnline(false);
    }, this.timeoutMs);
    this.sync();
  }

  private setOnline(online: boolean): void {
    if (online === this.online) return;
    this.online = online;
    this.changed(online);
  }
}
