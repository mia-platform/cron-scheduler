/* eslint-disable no-process-exit */
'use strict'

const got = require('got')
const pinoClass = require('pino')
const { MongoClient } = require('mongodb')
const Ajv = require('ajv')

const { sequential } = require('./lib/sequential.js')

const ajv = new Ajv({ removeAdditional: true, useDefaults: true, coerceTypes: true })
const envSchema = {
  additionalPropertes: false,
  type: 'object',
  required: ['MONGO_URL', 'LOG_LEVEL'],
  properties: {
    MONGO_URL: {
      type: 'string',
    },
    MONGO_COLLECTION: {
      type: 'string',
      default: 'curl-store',
    },
    LOG_LEVEL: {
      type: 'string',
    },
  },
}

const ALLOWED_STATES = [200, 204]
const MAX_ATTEMPTS = 10

// eslint-disable-next-line no-process-env
const dataEnv = process.env
ajv.validate(envSchema, dataEnv)
const { MONGO_URL, MONGO_COLLECTION, LOG_LEVEL } = dataEnv

const logger = pinoClass({ level: LOG_LEVEL })


if (ajv.errors) {
  logger.error(ajv.errors, 'Environment variable problem')
  process.exit(1)
}

const PENDING = 'PENDING'
const SENDING = 'SENDING'
const SENT = 'SENT'
const ERROR = 'ERROR'

let mongo

const manageErrorCurl = (collection, _id, attempt, maxAttempts = MAX_ATTEMPTS) => {
  if (!attempt || attempt < maxAttempts) {
    logger.trace(`Restore PENDING state for ${_id}`)
    return collection.updateOne({ _id }, { $set: { state: PENDING }, $inc: { attempt: 1 } })
  } else {
    logger.trace(`Set ERROR state for ${_id}`)
    return collection.updateOne({ _id }, { $set: { state: ERROR }, $inc: { attempt: 1 } })
  }
}

const manageSentCurl = (collection, _id) => {
  logger.trace(`Set SENT state for ${_id}`)
  return collection.updateOne({ _id }, { $set: { state: SENT }, $inc: { attempt: 1 } })
}

const trySendPush = (collection, { _id, body, url, headers, attempt, maxAttempts }) => {
  logger.trace(`Incoming Curl ${_id}`)

  logger.info({ _id, body, url, headers, maxAttempts }, 'Sending following push')

  return got.post(url, {
    body,
    headers: JSON.parse(headers),
  })
    .then(({ statusCode }) => {
      if (ALLOWED_STATES.includes(statusCode) === false) {
        logger.error(`Answer ok, but status code was: ${statusCode}`)
        return manageErrorCurl(collection, _id, attempt, maxAttempts)
      }
      return manageSentCurl(collection, _id)
    })
    .catch(({ statusCode, message }) => {
      logger.error({ statusCode, url, message }, 'Push failed. Check code, statusCode and Url')
      return manageErrorCurl(collection, _id, attempt, maxAttempts)
    })
}

const execute = async() => {
  logger.info({ MONGO_COLLECTION }, 'Connecting to MongoDB')
  mongo = await MongoClient.connect(MONGO_URL, { useNewUrlParser: true })

  const collection = await mongo.db().collection(MONGO_COLLECTION)
  await collection.ensureIndex({ state: 1 })

  const sendingCurls = await collection.count({ state: SENDING })

  if (sendingCurls > 0) {
    logger.info(`Found ${sendingCurls} curls in SENDING state -- Exit process`)
    return
  }

  const curls = []

  let result

  do {
    result = await collection.findOneAndUpdate(
      { state: PENDING },
      { $set: { state: SENDING } },
      { returnOriginal: false, sort: { createdAt: 1 } }
    )

    logger.trace(`Query Result is ${JSON.stringify(result)}`)

    if (result.value) {
      curls.push(result.value)
    }
  } while (result.value)

  logger.info(`Found ${curls.length} curls to send`)

  const promises = curls.map(curl => () => trySendPush(collection, curl))

  const sequence = await sequential(promises)

  return sequence
}

return execute()
  .catch((error) => logger.error(error))
  .then(() => mongo.close())
  .then(() => process.exit(0))
