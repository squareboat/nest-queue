import { DriverJob } from "../jobs";
import { Message } from "./Message";

export interface QueueDriver {
  push(message: string, rawMessage: Message): Promise<void>;

  pull(options: Record<string, any>): Promise<DriverJob | null>;

  remove(job: DriverJob, options: Record<string, any>): Promise<void>;
}
