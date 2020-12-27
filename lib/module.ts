import { DynamicModule, Module, Provider, Type } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";
import { EventModule } from "@squareboat/nest-events";
import { QueueConsoleCommands } from "./console/QueueConsoleCommands";
import { QUEUE_OPTIONS } from "./constants";
import { QueueExplorer } from "./explorer";
import {
  QueueAsyncOptions,
  QueueAsyncOptionsFactory,
  QueueOptions,
} from "./interfaces";
import { QueueMetadata } from "./metadata";
import { QueueService } from "./service";

@Module({})
export class QueueModule {
  /**
   * Register options
   * @param options
   */
  static register(options: QueueOptions): DynamicModule {
    return {
      global: options.isGlobal || false,
      module: QueueModule,
      imports: [DiscoveryModule, EventModule],
      providers: [
        QueueExplorer,
        QueueService,
        QueueMetadata,
        QueueConsoleCommands,
        { provide: QUEUE_OPTIONS, useValue: options },
      ],
    };
  }

  /**
   * Register Async Options
   */
  static registerAsync(options: QueueAsyncOptions): DynamicModule {
    return {
      global: options.isGlobal || false,
      module: QueueModule,
      imports: [DiscoveryModule, EventModule],
      providers: [
        QueueExplorer,
        QueueService,
        QueueMetadata,
        QueueConsoleCommands,
        this.createQueueOptionsProvider(options),
      ],
    };
  }

  private static createQueueOptionsProvider(
    options: QueueAsyncOptions
  ): Provider {
    if (options.useFactory) {
      return {
        provide: QUEUE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    const inject = [
      (options.useClass || options.useExisting) as Type<QueueOptions>,
    ];

    return {
      provide: QUEUE_OPTIONS,
      useFactory: async (optionsFactory: QueueAsyncOptionsFactory) =>
        await optionsFactory.createQueueOptions(),
      inject,
    };
  }
}
