var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

/* eslint no-unused-vars: off */

const R = require('ramda');
const { contained } = require('ramda-adjunct');
const path = require('path');

const { getFS } = require('./common');
const { splitAndTrim, isTime, isConnector } = require('../utils/models');
const Transaction = require('../models/transaction');
const { isRelativePath } = require('../utils/files');
const { LEDGER_COMMENTS, LEDGER_LINE_COMMENT } = require('../models/constants');
const Entry = require('../models/entry');

const trimRight = val => val.trimRight;
const isCommentChar = contained(LEDGER_COMMENTS);
const isLeadingCommentLine = val => isCommentChar(val.slice(0, 1));
const stripLeadingCommentLines = R.reject(isLeadingCommentLine);
const isCommentLine = val => isCommentChar(val.trimLeft().slice(0, 1));
const isNumeric = contained('0123456789');
const isNewTransactionLine = val => isNumeric(val.slice(0, 1));
const isAccountKey = contained(['id', 'account', 'note', 'status', 'address', 'party']);
const addEqualsConnector = R.insert(0, '=');
const lineCommentSpaces = /\; */;
const isCommentToken = R.startsWith(LEDGER_LINE_COMMENT);
const lastTokenIsComment = val => isCommentToken(R.last(val));
const findConnector = R.findIndex(isConnector);

function shortcutFromLedgerLine(line) {
  const clean = line.replace(lineCommentSpaces, ';').replace(/@@/g, '=');
  let parts = Entry.tokenizeShortcut(clean);
  const comment = lastTokenIsComment(parts) ? parts.pop() : null;
  const account = parts.shift();
  if (parts.length <= 3) {
    // in Ledger format, if it is a single-posting, then it is a debit
    // so use the leading-equals shortcut for that.
    parts = addEqualsConnector(parts);
  }

  const connectorIx = findConnector(parts);
  if (connectorIx) {
    parts = R.insert(connectorIx, account, parts);
  } else {
    parts.push(account);
  }

  if (comment) {
    parts.push(comment);
  }
  return parts.join(' ');
}

function convertLedgerTransaction(lines) {
  const header = splitAndTrim(lines.shift());
  // get the utc, replacing / with -.
  let utc = header.shift().split('/').join('-');
  let status = '';

  // has time?
  if (header[0].length > 1 && isTime(header[0])) {
    utc = `${utc} ${header.shift()}`;
  }
  if (header[0].length === 1 && header.length > 1) {
    status = header.shift();
    if (status === '*') {
      status = 'cleared';
    }
  }
  const party = header.join(' ');
  const extra = {};
  let account = '';
  const address = '';
  const notes = [];
  const props = {};
  const entryLines = [];
  // process comment lines first, so that all we will have left are entries
  lines.forEach(line => {
    if (!isLeadingCommentLine(line)) {
      entryLines.push(line);
    } else {
      const linetext = line.slice(1);
      if (line.indexOf(':') === -1) {
        notes.push(linetext);
      } else {
        const parts = linetext.split(':');
        const key = parts[0].toLowerCase();
        const val = parts.slice(1).join(':');
        if (key === 'notes') {
          notes.push(val);
        } else if (isAccountKey(key)) {
          props[key] = val;
        } else {
          extra[key] = val;
        }
      }
    }
  });
  // check to see if we have a default account
  if (entryLines.length > 0) {
    const lastLine = entryLines[entryLines.length - 1];
    if (lastLine.indexOf(' ') === -1) {
      // yes, this is an "elided" Ledger entry
      account = entryLines.pop();
    }
  }

  const entries = entryLines.map(shortcutFromLedgerLine);

  const tx = _extends({}, props, {
    utc,
    status,
    party,
    account,
    address,
    note: notes.join('\n'),
    extra,
    entries
  });
  //console.log('new TX:', JSON.stringify(tx, null, 2));
  return new Transaction(tx);
}

function loadLedgerTransactions(raw) {
  const lines = raw.replace(/\r/g, '').split('\n');
  const linesets = [];
  let accum = [];

  stripLeadingCommentLines(lines).forEach(line => {
    const clean = line.trimRight();
    if (!R.isEmpty(clean)) {
      if (isNewTransactionLine(line) && accum.length > 0) {
        linesets.push(accum);
        accum = [line];
      } else {
        accum.push(clean.trimLeft());
      }
    }
  });
  if (accum.length > 0) {
    linesets.push(accum);
  }

  // now we have an array of "linesets" which each are a transaction, hopefully.
  return linesets.map(convertLedgerTransaction);
}

function loadTransactionsFromFilenameSync(fname, directory) {
  let link = fname;
  if (directory && isRelativePath(fname)) {
    link = path.normalize(`${directory}/${fname}`);
  }
  return loadLedgerTransactions(getFS().readFileSync(link, 'utf-8'));
}

module.exports = {
  shortcutFromLedgerLine,
  loadTransactionsFromFilenameSync,
  loadLedgerTransactions,
  convertLedgerTransaction
};
//# sourceMappingURL=ledger_loader.js.map