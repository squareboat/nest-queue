## Introduction
Queues are a form of asynchronous service-to-service communication used in backend architecture. They can be used to decouple or defer heavy weight processing such as sending Mails, processing large database operations etc. Messages are kept in queue until processed. Seperating these heavy time consuming tasks drastically improves your response.

Above all, you can easily perform the processing of the messages on the distributed system without causing any workload spike on your consumer-facing server ever again.

__Supported Queues__

- Sync
- AWS SQS ([@squareboat/nest-queue-sqs](https://github.com/squareboat/nest-queue-sqs))
- Redis ([@squareboat/nest-queue-redis](https://github.com/squareboat/nest-queue-redis))
- RabbitMQ (Coming Soon)
- MySQL/Postgres (Coming Soon)
- MongoDB (Coming Soon)

__Few Hightlights__

- ✅ Easy to setup and configure
- ✅ Handle multiple queues with ease
- ✅ Harnesses the powerful DI system by NestJS for creating jobs
- ✅ Configurable messages, queues and jobs
- ✅ Delay jobs as per your requirement
- ✅ Run multiple queues in parallel

## Installation

Requires NestJS 10, 11 or 12 and Node.js 20.19+ or 22.12+.

```bash
npm i @squareboat/nest-queue @squareboat/nest-console
# plus the driver you use, e.g.
npm i @squareboat/nest-queue-redis
```

## Usage

### Register the module

```typescript
import { Module } from "@nestjs/common";
import { ConsoleModule } from "@squareboat/nest-console";
import { QueueModule } from "@squareboat/nest-queue";
import { RedisQueueDriver } from "@squareboat/nest-queue-redis";

@Module({
  imports: [
    ConsoleModule, // for the queue:work, queue:length and queue:purge commands
    QueueModule.register({
      isGlobal: true,
      default: "notifications",
      connections: {
        notifications: {
          driver: RedisQueueDriver,
          queue: "notifications",
          host: process.env.REDIS_HOST ?? "127.0.0.1",
          port: Number(process.env.REDIS_PORT ?? 6379),
          database: 0,
        },
      },
    }),
  ],
})
export class AppModule {}
```

Every connection has a `driver` and the driver's own options (see the driver's README). `SyncQueueDriver` (exported by this package) runs jobs right away, which is handy in tests.

With `registerAsync()`, list **modules** in `imports` (not providers like `ConfigService`):

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { QueueModule, QueueOptions } from "@squareboat/nest-queue";
import { RedisQueueDriver } from "@squareboat/nest-queue-redis";

@Module({
  imports: [
    ConfigModule.forRoot(),
    QueueModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): QueueOptions => ({
        default: "notifications",
        connections: {
          notifications: {
            driver: RedisQueueDriver,
            queue: "notifications",
            host: config.get("REDIS_HOST", "127.0.0.1"),
            port: Number(config.get("REDIS_PORT", 6379)),
            database: 0,
          },
        },
      }),
    }),
  ],
})
export class AppModule {}
```

`useClass` and `useExisting` take a class that implements `QueueAsyncOptionsFactory` (`createQueueOptions()`).

| Option | Description |
|---|---|
| `default` | Name of the connection used when a job does not name one |
| `connections` | `{ [name]: { driver, ...driver options } }` |
| `isGlobal` | Register the module globally |
| `shutdownTimeout` | On `app.close()`, how long (ms) to wait for running workers and then for each connection to close. Default `5000` |

### Create jobs

```typescript
import { Injectable } from "@nestjs/common";
import { Job } from "@squareboat/nest-queue";

@Injectable()
export class NotificationJobs {
  @Job("send-welcome-mail", { tries: 3, delay: 0 })
  async sendWelcomeMail(data: { email: string }): Promise<void> {
    // send the mail
  }
}
```

Add the class to the `providers` of a module. Job options (`delay` in seconds, `tries`, `queue`, `connection`) can also be passed per dispatch. Unless you set them, a job waits 10 seconds (`delay: 10`) and is tried up to 5 times.

### Dispatch jobs

```typescript
import { Dispatch } from "@squareboat/nest-queue";

export async function welcome(email: string): Promise<void> {
  await Dispatch({ job: "send-welcome-mail", data: { email } });
  await Dispatch({ job: "send-welcome-mail", data: { email }, delay: 60, connection: "notifications" });
}
```

### Run the worker

With [`@squareboat/nest-console`](https://github.com/squareboat/nest-console) set up:

```bash
node cli queue:work                        # default connection and queue
node cli queue:work --connection=notifications --queue=notifications --sleep=1000
node cli queue:length
node cli queue:purge
```

`--sleep` is the wait in ms between polls when the queue is empty (default `5000`, `0` is allowed). You can also start a worker in code: `QueueWorker.init({ connection: "notifications" }).listen()` runs until `worker.stop()` or `app.close()`. A failing job, a failing listener or a failed poll is logged and the worker keeps running. A job that throws is retried until it reaches `tries`; a job name with no `@Job()` handler fails the same way.

### Job events

```typescript
import { Injectable } from "@nestjs/common";
import { OnJobFailed, OnJobProcessed, OnJobProcessing } from "@squareboat/nest-queue";

@Injectable()
export class JobEvents {
  @OnJobProcessing()
  async processing(payload: { message: { job: string } }): Promise<void> {}

  @OnJobProcessed()
  async processed(payload: { message: { job: string } }): Promise<void> {}

  @OnJobFailed()
  async failed(payload: { message: { job: string; attemptCount: number }; error?: unknown }): Promise<void> {}
}
```

Listeners are awaited. An error thrown by a listener is logged; it does not fail the job.

### Shutdown

`app.close()` stops the workers of the app (a running job is finished first), then calls `disconnect()` on every connection whose driver has one, so the process can exit. Each step waits at most `shutdownTimeout` ms. Writing your own driver? Implement `QueueDriver` from `@squareboat/nest-queue-strategy` and, if it holds a connection, add an optional `async disconnect(): Promise<void>`.

## Upgrading from 0.1.x

- NestJS 7, 8 and 9 and Node.js before 20.19 (and 22.0 to 22.11) are no longer supported. `@squareboat/nest-console` 2 is required.
- **Sync driver:** `Dispatch()` now waits for the job and rejects with the job's error. Before, it resolved right away and a failing job crashed the process with an unhandled rejection. Catch the error where you dispatch if a failing job must not fail the caller.
- A job with no registered `@Job()` handler now fails (logged, `JobFailed`, retried up to `tries`). Before, it was dropped silently.
- `@OnJobProcessing()`, `@OnJobProcessed()` and `@OnJobFailed()` listeners are now awaited, and their errors are logged. Before, a throwing listener crashed the worker. `JobProcessed` listeners now run after the job was removed from the queue. `JobFailed` listeners also get the `error`.
- A failed job is removed once before it is retried. Before, it was removed twice, which on SQS made the retry fail (the job was lost) and stopped the worker.
- The worker no longer stops when a job run, a poll or a scheduled task fails; it logs the error and continues.
- `app.close()` now stops the workers and closes the driver connections (see Shutdown). Before, the process stayed alive.
- `queue:work --sleep=0` now means no wait; before, `0` was ignored.
- Driver options accept any value (`process.env.X`, `null`, booleans), and `isGlobal` is optional in `registerAsync()`.
- `registerAsync()` now uses `imports`, and `useClass` works.

## Documentation

To read the complete documentation, [click here](https://squareboat.com/open-source/nest-queue/).

## Contributing

To know about contributing to this package, read the guidelines [here](./CONTRIBUTING.md)


## About Us

We are a bunch of dreamers, designers, and futurists. We are high on collaboration, low on ego, and take our happy hours seriously. We'd love to hear more about your product. Let's talk and turn your great ideas into something even greater! We have something in store for everyone. [☎️ 📧 Connect with us!](https://squareboat.com/contact)

## License

The MIT License. Please see License File for more information. Copyright © 2020 SquareBoat.

Made with ❤️ by [Squareboat](https://squareboat.com)
