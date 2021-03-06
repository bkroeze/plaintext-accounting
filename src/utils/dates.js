import Moment from 'moment';
import * as R from 'ramda';
import * as RA from 'ramda-adjunct';
import { makeError } from './errors';
import { ERRORS } from '../models/constants';

export function averageDates(date1, date2) {
  let d1;
  let d2;
  if (date1.isBefore(date2)) {
    d1 = date1;
    d2 = date2;
  } else {
    d1 = date2;
    d2 = date1;
  }
  return Moment(d1.add(d2.diff(d1) / 2), 'ms');
}

export function compareByDate(a, b) {
  if (a.utc.isBefore(b.utc)) {
    return -1;
  }
  if (a.utc.isAfter(b.utc)) {
    return 1;
  }
  return 0;
}

export function ensureDate(work) {
  if (Moment.isMoment(work)) {
    return work.toDate();
  }
  if (RA.isString(work)) {
    return Moment.utc(work).toDate();
  }
  if (RA.isNumber(work)) {
    return Moment(work).toDate();
  }
  if (RA.isObj(work) && R.has('utc', work)) {
    return ensureDate(work.utc);
  }
  throw new Error(`Cannot parse date: ${work}`);
}

export function ensureMoment(work) {
  if (Moment.isMoment(work)) {
    return work;
  } if (RA.isString(work)) {
    return Moment(work);
  } if (RA.isObj(work) && R.has('utc', work)) {
    return ensureMoment(work.utc);
  }
  throw makeError(TypeError, ERRORS.INVALID_TERM, `Invalid search term: ${work}`);
}
