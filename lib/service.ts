import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleDestroy,
} from "@nestjs/common";
import { QUEUE_OPTIONS } from "./constants";
import { QueueOptions } from "./interfaces";
import { QueueMetadata } from "./metadata";
import { QueueDriver } from "@squareboat/nest-queue-strategy";

/** A running `QueueWorker.listen()` loop */
interface RunningWorker {
  /** Stop pulling jobs; resolves when the current job (if any) is done */
  stop(): Promise<void>;
}

const DEFAULT_SHUTDOWN_TIMEOUT = 5000;

@Injectable()
export class QueueService implements OnModuleDestroy, OnApplicationShutdown {
  private static connections: Record<string, any> = {};
  private static workers = new Set<RunningWorker>();
  private static closing = false;

  private readonly logger = new Logger("QueueService");
  /** Drivers created by this instance, closed on shutdown */
  private readonly created: Record<string, any> = {};

  constructor(@Inject(QUEUE_OPTIONS) private options: QueueOptions) {
    QueueService.closing = false;
    for (const connName in this.options.connections) {
      const connection = this.options.connections[connName];
      const driver: any = connection.driver;
      this.created[connName] = new driver(connection);
      QueueService.connections[connName] = this.created[connName];
    }
  }

  static getConnection(connection: string | undefined): QueueDriver {
    const options = QueueMetadata.getData();
    if (!connection) connection = options.default;
    return QueueService.connections[connection];
  }

  /**
   * Used by `QueueWorker.listen()`. Returns a function that unregisters it.
   */
  static registerWorker(worker: RunningWorker): () => void {
    QueueService.workers.add(worker);
    return () => QueueService.workers.delete(worker);
  }

  /** True once the application is shutting down (`app.close()`) */
  static isClosing(): boolean {
    return QueueService.closing;
  }

  /** Workers stop pulling new jobs as soon as shutdown starts */
  onModuleDestroy(): void {
    QueueService.closing = true;
    for (const worker of QueueService.workers) worker.stop().catch(() => {});
  }

  /**
   * Wait for running workers to finish their current job, then close every
   * connection whose driver has a `disconnect()` method. Each step waits at
   * most `shutdownTimeout` ms (default 5000), so shutdown never hangs.
   */
  async onApplicationShutdown(): Promise<void> {
    QueueService.closing = true;
    const limit = this.options.shutdownTimeout ?? DEFAULT_SHUTDOWN_TIMEOUT;

    const workers = [...QueueService.workers].map((w) => w.stop());
    if (workers.length) {
      const stopped = await settleWithin(Promise.all(workers), limit);
      if (stopped === "timeout") {
        this.logger.warn(
          `A queue worker was still running a job after ${limit} ms; closing the connections anyway`
        );
      }
    }

    await Promise.all(
      Object.entries(this.created).map(async ([name, driver]) => {
        if (!driver || typeof driver.disconnect !== "function") return;
        try {
          const result = await settleWithin(
            Promise.resolve().then(() => driver.disconnect()),
            limit
          );
          if (result === "timeout") {
            this.logger.warn(
              `Queue connection "${name}" did not disconnect within ${limit} ms`
            );
          }
        } catch (e) {
          this.logger.error(
            `Queue connection "${name}" failed to disconnect: ${
              e instanceof Error ? e.message : String(e)
            }`
          );
        }
      })
    );
  }
}

/** Resolves "done" when `promise` resolves, "timeout" after `ms`; rethrows its rejection */
async function settleWithin(
  promise: Promise<unknown>,
  ms: number
): Promise<"done" | "timeout"> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), ms);
  });
  try {
    return await Promise.race([promise.then(() => "done" as const), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
