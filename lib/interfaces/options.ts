import { ModuleMetadata, Type } from "@nestjs/common";
import { QueueDriver } from "@squareboat/nest-queue-strategy";

export interface QueueDriverOptions {
  driver: Type<QueueDriver>;
  /**
   * Driver specific options (host, port, url, queue, region, ...). Typed loosely
   * so values like `process.env.X` (`string | undefined`), `null` and booleans
   * compile under `strict`; each driver validates its own options.
   */
  [key: string]: any;
}

export interface QueueOptions {
  isGlobal?: boolean;
  default: string;
  connections: {
    [key: string]: QueueDriverOptions;
  };
  /**
   * On `app.close()`: how long (ms) to wait for running workers to finish
   * their current job, and then for each connection to disconnect.
   * Default 5000.
   */
  shutdownTimeout?: number;
}

export interface QueueAsyncOptionsFactory {
  createQueueOptions(): Promise<QueueOptions> | QueueOptions;
}

export interface QueueAsyncOptions extends Pick<ModuleMetadata, "imports"> {
  name?: string;
  isGlobal?: boolean;
  useExisting?: Type<QueueAsyncOptionsFactory>;
  useClass?: Type<QueueAsyncOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<QueueOptions> | QueueOptions;
  inject?: any[];
}

export interface ListenerOptions {
  sleep?: number;
  connection?: string;
  queue?: string;
  schedulerInterval?: number;
  logger?: boolean;
}
