import * as R from 'ramda';

import * as utils from './modelUtils';

const DEFAULT_PROPS = {
  path: '',
  alias: '',
  note: '',
  tags: [],
  portfolio: '',
  parent: null,
  children: {},
};

const KEYS = R.keysIn(DEFAULT_PROPS);

const getProps = R.pick(KEYS);

function getBalanceQty(e) {
  return e.type === 'debit' ? e.quantity : e.quantity.times(-1);
}

function entrySorter(a, b) {
  const utcA = a.getUtc();
  const utcB = b.getUtc();
  if (utcA.isBefore(utcB)) {
    return -1;
  }
  if (utcA.isAfter(utcB)) {
    return 1;
  }
  if (a.addIndex < b.addIndex) {
    return 0;
  }
}

export default class Account {
  /**
   * Construct using a `props` object that must include "path", and may also include "name" and "notes"
   * @param {object} props
   */
  constructor(props={}) {
    this.dirty = {
      entries: false,
    }
    this.entries = []; // not constructed using "props" at this point
    const merged = R.merge(DEFAULT_PROPS, getProps(props));
    let children = [];

    KEYS.forEach(key => {
      if (key === 'children') {
        children = merged.children;
      } else {
        this[key] = merged[key];
      }
    });

    if (!this.path) {
      console.error(`Invalid Account, must have a path, got: ${JSON.stringify(props)}`);
      throw new Error('Invalid Account, must have a path');
    }
    if (this.parent) {
      this.path = `${this.parent.path}:${this.path}`;
    }
    if (!this.alias) {
      this.alias == this.path;
    }

    this.children = Account.makeChildAccounts(this, children);
  }

  static makeChildAccounts(parent, children) {
    const accounts = {};
    R.keysIn(children).forEach(path => {
      const child = children[path];
      accounts[path] = new Account(R.merge(child, {parent, path}));
    });
    return accounts;
  }

  addEntry(entry) {
    entry.addIndex = this.entries.length;
    this.entries.push(entry);
    this.dirty.entries = true;
  }

  /**
   * Get a child account
   */
  getAccount(key) {
    let path = R.clone(key);
    if (utils.isString(path)) {
      path = path.split(':');
    }
    const nextChild = path.shift();
    let child = this.children[nextChild];
    if (!child) {
      throw new ReferenceError(`Account Not Found: ${this.path}:${nextChild}`);
    }
    if (path.length > 0) {
      child = child.getAccount(path);
    }
    return child;
  }

  getEntries() {
    if (this.dirty.entries) {
      this.entries.sort(entrySorter);
      this.dirty.entries = false;
    }
    return this.entries;
  }

  getBalances(balances = {}) {
    this.getEntries().forEach(e => {
      const qty = getBalanceQty(e);
      if (!R.has(e.currency, balances)) {
        balances[e.currency] = qty;
      } else {
        balances[e.currency] = balances[e.currency].plus(qty);
      }
    });
    return balances;
  }

  getBalancesByAccount() {
    let balances = {};
    balances[this.path] = this.getBalances();
    Object.values(this.children).forEach(child => {
      balances = R.merge(balances, child.getBalancesByAccount())
    });
    return balances;
  }

  getTotalBalances() {
    const balances = this.getBalances();
    Object.values(this.children).forEach(child => {
      const childBalances = child.getTotalBalances();
      Object.keys(childBalances).forEach(currency => {
        if (!R.has(currency, balances)) {
          balances[currency] = childBalances[currency];
        } else {
          balances[currency] = balances[currency].plus(childBalances[currency]);
        }
      });
    });
    return balances;
  }

  toObject() {
    return utils.stripFalsyExcept({
      path: this.path,
      alias: this.alias,
      note: this.note,
      tags: this.tags,
      portfolio: this.portfolio,
      children: utils.objectValsToObject(this.children),
      entries: this.entries.map(utils.toObject),
    });
  }

  toString() {
    return `Currency: ${this.id}`;
  }
}

/**
 * Make an accounts object from a yaml description
 */
export function makeAccounts(raw) {
  const accounts = {};
  R.keysIn(raw).forEach(path => {
    accounts[path] = new Account(R.merge(raw[path], {path}));
  });
  return accounts;
}

