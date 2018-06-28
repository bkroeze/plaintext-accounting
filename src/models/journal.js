import * as R from 'ramda';

import { makeAccounts } from './account';
import { makeTransactions } from './transaction';
import { makeCurrencies } from './currency';
import * as utils from './modelUtils';

const DEFAULT_PROPS = {
  id: null,
  accounts: {},
  currencies: {},
  transactions: [],
};

const KEYS = R.keysIn(DEFAULT_PROPS);
const getProps = R.pick(KEYS);

function getAccount(accounts, key) {
  let path = key;
  if (utils.isString(path)) {
    path = path.split(':');
  }
  let account = accounts[path.shift()];
  if (path.length) {
    account = account.getAccount(path);
  }
  if (!account) {
    throw new ReferenceError(`Account Not Found: ${key}`);
  }
  return account;
}

export default class Journal {
  /**
   * Construct using a `props` object from YAML
   * @param {object} props
   */
  constructor(props) {
    const merged = R.merge(DEFAULT_PROPS, getProps(props));
    this.id = merged.id;
    this.setAccounts(makeAccounts(merged.accounts));
    this.setCurrencies(makeCurrencies(merged.currencies));
    this.setTransactions(makeTransactions(merged.transactions));
  }

  checkAndApply() {
    if (this.transactions && this.transactions.length > 0 && !R.isEmpty(this.accounts)) {
      const getter = R.curry(getAccount)(this.accounts);
      this.transactions.forEach((tx) => {
        tx.applyToAccounts(getter);
      });
    }
  }

  getAccount(key) {
    return getAccount(this.accounts, key);
  }

  /**
   * Get balances for all accounts
   * @param {Function} filter to apply to entries
   * @return {object} balances keyed by account path
   */
  getBalancesByAccount(entryFilter) {
    let balances = {};
    Object.keys(this.accounts).forEach((account) => {
      balances = R.merge(balances, this.accounts[account].getBalancesByAccount(entryFilter));
    });
    return balances;
  }

  setAccounts(accounts) {
    this.accounts = accounts;
    this.checkAndApply();
  }

  setCurrencies(currencies) {
    this.currencies = currencies;
    // this.checkAndApply();
  }

  setTransactions(transactions) {
    this.transactions = transactions;
    this.checkAndApply();
  }

  toObject() {
    return utils.stripFalsyExcept({
      id: this.id,
      accounts: utils.objectValsToObject(this.accounts),
      currencies: utils.objectValsToObject(this.currencies),
      transactions: this.transactions.map(utils.toObject),
    });
  }
}
