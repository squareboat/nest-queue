import { ModuleMetadata, Type } from "@nestjs/common";

export interface SqsBrokerOption {
  driver: "sqs";
  profile: string;
  apiVersion: string;
  prefix: string;
  queue: string;
  suffix?: string;
  region: string;
}

export interface QueueOptions {
  isGlobal?: boolean;
  default: string;
  connections: {
    [key: string]: SqsBrokerOption;
  };
}

export interface QueueAsyncOptionsFactory {
  createQueueOptions(): Promise<QueueOptions> | QueueOptions;
}

export interface QueueAsyncOptions extends Pick<ModuleMetadata, "imports"> {
  name?: string;
  isGlobal: boolean;
  useExisting?: Type<QueueOptions>;
  useClass?: Type<QueueAsyncOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<QueueOptions> | QueueOptions;
  inject?: any[];
}

export interface ListenerOptions {
  sleep?: number;
  connection?: string;
  queue?: string;
}
