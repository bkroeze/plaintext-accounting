/* eslint no-use-before-define: off */
const R = require('ramda');
const path = require('path');
const { safeLoad } = require('js-yaml');
const { isRelativePath } = require('../utils/files');
const loadLedgerTransactions = require('./ledger_loader').loadTransactionsFromFilenameSync;
const { getFS } = require('./common');

const hasRef = R.has('$ref');
const isObjectByKey = (obj, key) => R.is(Object, R.prop(key, obj));
const objectTester = R.curry(isObjectByKey);

/**
 * Finds the paths for every instance of "$ref" as a key
 * @param {Object} work object to search
 * @param {Array<String>} path existing path to extend
 * @return {Array<Object<Array<String>, String>>} An array of paths, given as
 *   {path: array, link: string}
 */
function findRefs(work, refPath = []) {
  let refs = [];

  if (hasRef(work)) {
    refs.push({ path: refPath, link: work.$ref });
  }
  const tester = objectTester(work);
  R.filter(tester, R.keysIn(work)).forEach((key) => {
    // the key is a key for an object in work
    // so recurse, with the current refPath
    // adding to refs each time.
    refs = R.concat(refs, findRefs(work[key], R.concat(refPath, [key])));
  });
  return refs;
}

function loadYamlFromFilenameSync(fname, directory) {
  let link = fname;
  if (directory && isRelativePath(fname)) {
    link = path.normalize(`${directory}/${fname}`);
  }
  return loadRefs(safeLoad(getFS().readFileSync(link, 'utf-8')), directory);
}

function flexibleLoadByExtSync(fname, directory) {
  const ext = path.extname(fname).toLowerCase();
  if (ext === '.dat' || ext === '.ledger' || ext === '.ldr') {
    return loadLedgerTransactions(fname, directory);
  }
  return loadYamlFromFilenameSync(fname, directory);
}

function loadRef(work, reference, directory) {
  const { link } = reference;
  let child;
  if (R.is(String, link)) {
    child = flexibleLoadByExtSync(link, directory);
  } else {
    const refList = link.map(l => flexibleLoadByExtSync(l, directory));
    if (R.is(Array, refList[0])) {
      // flatten array
      child = R.flatten(refList);
    } else {
      // merge the results into one object
      child = R.mergeAll(refList);
    }
  }
  const merged = R.dissocPath(R.concat(reference.path, ['$ref']), work);
  return R.assocPath(reference.path, child, merged);
}

function loadRefs(work, directory) {
  let merged = work;
  findRefs(work).forEach((ref) => {
    // and merge in the result of loading the link
    merged = loadRef(merged, ref, directory);
  });
  return merged;
}

module.exports = {
  findRefs,
  flexibleLoadByExtSync,
  loadRef,
  loadRefs,
  loadYamlFromFilenameSync,
};
