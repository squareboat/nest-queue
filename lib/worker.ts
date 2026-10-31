import { ListenerOptions } from "./interfaces";
import { QueueMetadata } from "./metadata";
import { QueueService } from "./service";
import { JobRunner } from "./jobrunner";
import { DriverJob, QueueDriver } from "@squareboat/nest-queue-strategy";
import { Logger } from "@squareboat/nest-console";

export class QueueWorker {
  private options: ListenerOptions;
  private stopping = false;
  private running?: Promise<void>;
  private wakeUp?: () => void;

  constructor(options?: ListenerOptions) {
    const defaultOptions = QueueMetadata.getDefaultOptions();
    this.options = options || {};
    this.options = {
      ...defaultOptions,
      schedulerInterval: 10000,
      queue: undefined,
      logger: true,
      ...this.options,
    };

    if (!this.options.queue) {
      const data = QueueMetadata.getData();
      this.options["queue"] = data.connections[
        this.options.connection || defaultOptions.connection
      ].queue as string;
    }
  }

  static init(options?: ListenerOptions): QueueWorker {
    return new QueueWorker(options);
  }

  private async poll(connection: QueueDriver): Promise<DriverJob | null> {
    const job = await connection.pull({ queue: this.options.queue });
    return job;
  }

  /**
   * Listen to the queue. Runs until `stop()` is called or the application
   * shuts down (`app.close()`), then resolves.
   */
  async listen(): Promise<void> {
    if (this.running) return this.running;
    this.stopping = false;
    const unregister = QueueService.registerWorker(this);
    this.running = this.work().finally(() => {
      unregister();
      this.running = undefined;
    });
    return this.running;
  }

  /**
   * Stop pulling jobs. Resolves when the job that is running (if any) is done.
   */
  stop(): Promise<void> {
    this.stopping = true;
    if (this.wakeUp) this.wakeUp();
    return this.running || Promise.resolve();
  }

  private shouldStop(): boolean {
    return this.stopping || QueueService.isClosing();
  }

  private async work(): Promise<void> {
    const connection = QueueService.getConnection(this.options.connection);
    if (!connection) {
      // fail fast instead of logging a poll error forever
      throw new Error(
        `Queue connection "${this.options.connection}" is not configured`
      );
    }
    this.log("info", "LOG [QueueWorker] Queue Worker Initialised");

    // perform scheduled task of the driver
    const scheduler = this.performScheduledTask(connection);

    const runner = new JobRunner(this.options, connection);
    try {
      while (!this.shouldStop()) {
        let job: DriverJob | null;
        try {
          job = await this.poll(connection);
        } catch (e) {
          if (this.shouldStop()) break;
          // e.g. a network error: log it and try again after `sleep`
          this.log("error", `LOG [QueueWorker] Could not fetch a job | Error: ${errorMessage(e)}`);
          await this.sleep();
          continue;
        }

        if (!job) {
          await this.sleep();
          continue;
        }

        // a failing run (e.g. the driver could not remove or re-dispatch the
        // job) must not end the worker loop
        try {
          await runner.run(job);
        } catch (e) {
          this.log("error", `LOG [QueueWorker] Job run failed | Error: ${errorMessage(e)}`);
        }
      }
    } finally {
      if (scheduler) clearInterval(scheduler);
    }
    this.log("info", "LOG [QueueWorker] Queue Worker Stopped");
  }

  /** Wait `sleep` ms, or less when the worker is stopped meanwhile */
  private sleep(): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.wakeUp = undefined;
        resolve();
      };
      const timer = setTimeout(done, this.options.sleep);
      this.wakeUp = done;
    });
  }

  private performScheduledTask(
    connection: QueueDriver
  ): NodeJS.Timeout | undefined {
    if (!connection || !connection.scheduledTask) return;
    let running = false;
    return setInterval(async () => {
      // skip a tick while the previous one is still running, and never let a
      // failing tick become an unhandled rejection
      if (running || this.shouldStop() || !connection.scheduledTask) return;
      running = true;
      try {
        await connection.scheduledTask(this.options);
      } catch (e) {
        this.log("error", `LOG [QueueWorker] Scheduled task failed | Error: ${errorMessage(e)}`);
      } finally {
        running = false;
      }
    }, this.options.schedulerInterval || 10000);
  }

  async purge(): Promise<void> {
    const connection = QueueService.getConnection(this.options.connection);
    await connection.purge({ queue: this.options.queue });
    return;
  }

  async count(): Promise<number> {
    const connection = QueueService.getConnection(this.options.connection);
    return await connection.count({ queue: this.options.queue });
  }

  log(level: string, msg: string): void {
    if (!this.options.logger) return;
    let logger = undefined;
    switch (level) {
      case "info":
        logger = Logger.info;
        break;
      case "success":
        logger = Logger.success;
        break;
      case "error":
        logger = Logger.error;
        break;
      case "warn":
        logger = Logger.warn;
        break;
    }

    logger && logger(msg);
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
