import { EmitsEvent, Event } from '@squareboat/nest-events';
import { events } from '../constants';

@Event(events.jobProcessing)
export class JobProcessing extends EmitsEvent {}
