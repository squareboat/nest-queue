import { EmitsEvent, Event } from "@squareboat/nest-events";
import { events } from "../constants";

@Event(events.jobFailed)
export class JobFailed extends EmitsEvent {
  /**
   * @param error what the job threw (or why it could not run), so
   *   `@OnJobFailed()` listeners can see it as `payload.error`
   */
  constructor(public message: any, public job: any, public error?: unknown) {
    super();
  }
}
