import 'reflect-metadata';
import { JOB_NAME, JOB_OPTIONS } from './constants';
import { JobOptions } from './interfaces';

export function Job(job: string, options?: JobOptions) {
  options = options || {};
  return function(target: Record<string, any>, propertyKey: string) {
    Reflect.defineMetadata(JOB_NAME, job, target, propertyKey);
    Reflect.defineMetadata(JOB_OPTIONS, options, target, propertyKey);
  };
}
