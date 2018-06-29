/* eslint no-console: ["error", { allow: ["error"] }] */
import * as R from 'ramda';
import Moment from 'moment';

import { makeEntries } from './entry';
import { stripFalsyExcept, isString } from './modelUtils';

// stub out fee descriptors
const makeFees = fees => fees;

const DEFAULT_PROPS = {
  id: '',
  account: { credit: '', debit: '' },
  status: '',
  party: '',
  address: '',
  utc: '',
  note: '',
  fees: [],
  tags: [],
  entries: [],
  details: {},
};

const KEYS = R.keysIn(DEFAULT_PROPS);

const getProps = R.pick(KEYS);
const allBalanced = R.all(e => e.isBalanced());
const getDebits = R.reject(R.propEq('type', 'debit'));
const getCredits = R.reject(R.propEq('type', 'credit'));

export default class Transaction {
  /**
   * Construct using a `props` object that must include "utc", and may also
   * include "notes", "tags", and a list of transactions
   * @param {object} props
   */
  constructor(props = {}) {
    const merged = R.merge(DEFAULT_PROPS, getProps(props));
    const { entries, fees } = merged;

    KEYS.forEach((key) => {
      if (key !== 'transactions' && key !== 'fees') {
        let val = merged[key];
        if (key === 'account' && isString(val)) {
          val = { debit: val, credit: val };
        }
        this[key] = val;
      }
    });

    if (!this.utc) {
      console.error(`Invalid Transaction, must have a 'utc', got: ${JSON.stringify(props)}`);
      throw new Error('Invalid Transaction, must have a utc');
    }
    this.utc = Moment(this.utc);
    this.entries = makeEntries(entries, this);
    this.fees = makeFees(fees);
  }

  applyToAccounts(accountGetter) {
    this.entries.forEach(e => e.applyToAccount(accountGetter));
  }

  getCredits() {
    return getDebits(this.entries);
  }

  getDebits() {
    return getCredits(this.entries);
  }

  isBalanced() {
    return allBalanced(this.getDebits());
  }

  size() {
    return this.entries.length;
  }

  toObject() {
    return stripFalsyExcept({
      id: this.id,
      note: this.note,
      account: this.account,
      status: this.status,
      utc: this.utc.toISOString(),
      address: this.address,
      party: this.party,
      tags: this.tags,
      entries: this.entries.map(t => t.toObject()),
      fees: this.fees, // change to this.fees.map(f => t.toObject()) when unstub
      details: this.details,
    }, ['entries']);
  }

  toString() {
    return `Transaction: ${this.account} ${this.utc.toISOString} [${this.entries.length} entries]`;
  }
}

export const makeTransactions = raw => raw.map(tx => new Transaction(tx));
