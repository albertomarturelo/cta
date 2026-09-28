import type { Clock } from '../seams/seams.js';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
