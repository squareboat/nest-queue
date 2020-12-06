import { EmitsEvent, Event } from '@squareboat/nest-events';
import { events } from '../constants';

@Event(events.jobProcessed)
export class JobProcessed extends EmitsEvent {}
