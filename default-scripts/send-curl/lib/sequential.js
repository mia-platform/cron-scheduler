/* eslint-disable no-param-reassign */

const concatResult = (acc, elm) => {
  acc = acc.concat(elm)
  return Promise.resolve(acc)
}
const executePromise = (final, curl) => curl()
  .then(result => concatResult(final, result))

const aggregatePromises = (promiseAggregator, curl) => promiseAggregator
  .then(final => executePromise(final, curl))

const sequential = (promises) => {
  return promises.reduce((aggregator, curl) => aggregatePromises(aggregator, curl), Promise.resolve([]))
}

module.exports = { sequential }
