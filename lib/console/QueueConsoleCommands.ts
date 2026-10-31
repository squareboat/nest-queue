import { Injectable } from "@nestjs/common";
import { Command, ConsoleIO } from "@squareboat/nest-console";
import { ListenerOptions } from "../interfaces";
import { QueueWorker } from "../worker";

/** An option that was not passed is "" (from `{--x=}`), null or undefined */
const isSet = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== "";

/** --sleep, --connection and --queue as worker options (keeps --sleep=0) */
function workerOptions(_cli: ConsoleIO): ListenerOptions {
  const sleep = _cli.option<string | number>("sleep");
  const connection = _cli.option<string>("connection");
  const queue = _cli.option<string>("queue");

  const options: ListenerOptions = {};
  if (isSet(sleep)) {
    const ms = Number(sleep);
    if (!Number.isFinite(ms) || ms < 0) {
      throw new Error(`--sleep must be a number of milliseconds (>= 0), got "${sleep}"`);
    }
    options.sleep = ms;
  }
  if (isSet(connection)) options.connection = String(connection);
  if (isSet(queue)) options.queue = String(queue);
  return options;
}

@Injectable()
export class QueueConsoleCommands {
  /**
   * Command to run the queue worker, starts processing the jobs
   * @param args C
   */
  @Command("queue:work {--sleep=} {--connection=} {--queue=}", {
    desc: "Command to run the queue worker, starts processing the jobs",
  })
  public async startQueueWork(_cli: ConsoleIO): Promise<void> {
    const options = workerOptions(_cli);
    _cli.info("Starting queue worker");
    await QueueWorker.init(options).listen();
    return;
  }

  /**
   * Command to get the length of the specified queue
   * @param args
   */
  @Command("queue:length {--sleep=} {--connection=} {--queue=}", {
    desc: "Command to get the length of the specified queue",
  })
  public async getQueueLength(_cli: ConsoleIO): Promise<void> {
    const options = workerOptions(_cli);
    const response = await QueueWorker.init(options).count();
    _cli.info(`Number of messages in queue is ${response}`);
    return;
  }

  /**
   * Command to purge the queue
   * @param args
   */
  @Command("queue:purge {--sleep=} {--connection=} {--queue=}", {
    desc: "Command to purge the queue",
  })
  public async purgeQueue(_cli: ConsoleIO): Promise<void> {
    const options = workerOptions(_cli);

    const answer = await _cli.ask(
      `Do you really want to purge queue? Please be sure as this action is irreversible!\nWrite "yes,delete it" to purge the queue`
    );

    if (answer === "yes,delete it") {
      await QueueWorker.init(options).purge();
      _cli.info(" queue succesfully purged ");
      return;
    }

    _cli.error(" wrong key, exiting... ");
    return;
  }
}
