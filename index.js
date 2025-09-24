/*
 * Copyright © 2017 Mia s.r.l.
 * All rights reserved
 */

'use strict'

const child_process = require('child_process')
const path = require('path')

const { CronJob } = require('cron')
const pinoClass = require('pino')
const Ajv = require('ajv')

const envSchema = {
  type: 'object',
  required: ['CONFIG_PATH'],
  properties: {
    LOG_LEVEL: {
      type: 'string',
      default: 'debug',
    },
    CONFIG_PATH: {
      type: 'string',
    },
  },
}

const configSchema = {
  type: 'array',
  items: [
    {
      type: 'object',
      properties: {
        name: { type: 'string' },
        filePath: { type: 'string' },
        crontab: { type: 'string' },
        timezone: { type: 'string' },
        env: { type: 'object', default: {} },
      },
      required: [
        'name',
        'filePath',
        'crontab',
        'timezone',
      ],
    },
  ],
}

const ajv = new Ajv({ removeAdditional: true, useDefaults: true, coerceTypes: true })

// eslint-disable-next-line no-process-env
const dataEnv = process.env
const validEnv = ajv.validate(envSchema, dataEnv)

const { LOG_LEVEL, CONFIG_PATH } = dataEnv
const pino = pinoClass({ level: LOG_LEVEL })

if (!validEnv) {
  pino.error(ajv.errors)
  throw new Error('The environment is not valid.')
}

const configurations = require(CONFIG_PATH)

const valid = ajv.validate(configSchema, configurations)

if (!valid) {
  pino.error(ajv.errors)
  throw new Error('The configuration file is not valid.')
}

configurations.forEach(({ crontab, timezone, filePath, env, name, runOnInit }) => {
  const logger = pino.child({ cronName: name })

  if (ajv.errors) {
    pino.error(ajv.errors)
  }

  return new CronJob(crontab, () => {
    const absolutePath = path.resolve(process.cwd(), filePath)
    const cwd = path.dirname(absolutePath)
    const childProcess = child_process.fork(absolutePath, {
      cwd,
      env: Object.assign({}, env, { LOG_LEVEL }),
    })

    logger.info({ childPid: childProcess.pid, msg: 'Start' })

    childProcess.on('message', (message) => {
      logger.info({ childPid: childProcess.pid, message, msg: 'Message' })
    })

    childProcess.on('exit', (code) => {
      logger.info({ childPid: childProcess.pid, code, msg: 'Exit' })
    })

    childProcess.on('error', (error) => {
      logger.error({ pid: childProcess.pid, error, msg: 'Error' })
    })

    childProcess.on('close', (code) => {
      logger.info({ childPid: childProcess.pid, code, msg: 'Close' })
    })
  }, null, true, timezone, null, runOnInit)
})
