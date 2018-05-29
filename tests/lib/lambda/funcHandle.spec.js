const BbPromise = require('bluebird')
const chai = require('chai')
const path = require('path')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

BbPromise.longStackTraces()
chai.use(sinonChai)

const { expect, assert } = chai

// eslint-disable-next-line import/no-dynamic-require
const func = require(path.join('..', '..', '..', 'lib', 'lambda', 'func.js'))

describe('./lib/lambda/funcHandle.js', () => {
  const maxTimeoutBufferInMs = func.def.MAX_TIMEOUT_BUFFER_IN_MILLISECONDS
  let timeoutInMs
  const context = {
    getRemainingTimeInMillis: () => timeoutInMs,
  }
  beforeEach(() => {
    timeoutInMs = 300 * 1000
    func.def.MAX_TIMEOUT_BUFFER_IN_MILLISECONDS = maxTimeoutBufferInMs
    func.handle.done = false
  })
  afterEach(() => {
    if ('callback' in func.handle) {
      delete func.handle.callback
    }
    if ('context' in func.handle) {
      delete func.handle.context
    }
    if ('done' in func.handle) {
      delete func.handle.done
    }
  })
  describe(':impl', () => {
    describe('#handleUnhandledRejection', () => {
      it('prints to the console and calls the callback', () => {
        const callback = sinon.stub()
        const error = sinon.stub()
        func.handle.impl.handleUnhandledRejection(callback)(new Error('tag'), error)
        expect(error).to.have.been.calledOnce
        expect(callback).to.have.been.calledOnce
      })
    })
    describe('#handleTimeout', () => {
      it('prints to the console and calls the callback', () => {
        const callback = sinon.stub()
        const error = sinon.stub()
        func.handle.impl.handleTimeout(callback, error)
        expect(error).to.have.been.calledOnce
        expect(callback).to.have.been.calledOnce
      })
    })
    describe('#lambdaEntryPoint', () => {
      // todo
    })
    describe('#handler', () => {
      const handler = func.handle.impl.handler
      it('calls the given taskHandler with the given event', () => {
        const taskHandler = sinon.stub().returns(Promise.resolve())
        const event = {}
        const mergeIf = () => Promise.resolve(event)
        return handler(taskHandler, event, mergeIf)
          .then(() => assert.isOk(taskHandler.calledWithExactly(event)))
      })
      it('handles exceptions from the task handler and reports an error', () => {
        const taskHandler = sinon.stub()
          .returns(Promise.reject(new Error('reasons')))
        const event = {}
        const mergeIf = () => Promise.resolve(event)
        const expected = 'Error executing task: reasons'
        return handler(taskHandler, event, mergeIf, sinon.stub())
          .then(result => assert.strictEqual(result, expected))
      })
      it('handles merge exceptions and reports an error', () => {
        const taskHandler = sinon.stub().returns(Promise.resolve())
        const event = {}
        const mergeIf = () => Promise.reject(new Error('reasons'))
        const expected = 'Error validating event: reasons'
        return handler(taskHandler, event, mergeIf, sinon.stub())
          .then(result => assert.strictEqual(result, expected))
      })
    })
    describe('#getScriptPath', () => {
      const {
        getScriptPath,
        localPathError,
      } = func.handle.impl
      it('should fail for non-local absolute path', () =>
        assert.throws(
          () => getScriptPath('/foo', undefined, '/bar'),
          localPathError))
      it('should fail for non-local relative path', () =>
        assert.throws(
          () => getScriptPath('../foo', () => '/foo', '/bar'),
          localPathError))
      it('should succeed for absolute local path', () =>
        assert.strictEqual(
          getScriptPath('/foo/bar', undefined, '/foo'),
          '/foo/bar'))
      it('should succeed for relative local path', () =>
        assert.strictEqual(
          getScriptPath('bar', p => `/foo/${p}`, '/foo'),
          '/foo/bar'))
    })
    describe('#readScript', () => {
      const {
        readScript,
        readScriptError,
      } = func.handle.impl
      const mockReadFile = (err, data) =>
        (...args) => args[args.length - 1](err, data)
      it('should get the script path before reading', () => {
        const getScriptPath = sinon.stub().callsFake(p => p)
        const readFile = mockReadFile(undefined, 'bar')
        return readScript('foo', readFile, sinon.stub(), getScriptPath)
          .then(() => getScriptPath.calledWithExactly('foo'))
      })
      it('should log error with a bad script path', () => {
        const readFile = mockReadFile(undefined, 'bar')
        const log = sinon.stub()
        return readScript('../foo', readFile, log)
          .catch(err => err)
          .then(err =>
            log.calledWithExactly(readScriptError, '../foo', err.stack))
      })
      it('should log error with a failed read', () => {
        const readFile = mockReadFile(new Error('bar'))
        const log = sinon.stub()
        return readScript('../foo', readFile, log)
          .catch(err => err)
          .then(err =>
            log.calledWithExactly(readScriptError, '../foo', err.stack))
      })
      it('should parse yml', () => {
        const readFile = mockReadFile(undefined, 'bar: baz')
        const log = sinon.stub()
        return readScript('foo', readFile, log, p => p)
          .then(data => assert.deepStrictEqual(data, { bar: 'baz' }))
      })
      it('should parse json', () => {
        const readFile = mockReadFile(undefined, '{"bar": "baz"}')
        const log = sinon.stub()
        return readScript('foo', readFile, log, p => p)
          .then(data => assert.deepStrictEqual(data, { bar: 'baz' }))
      })
    })
  })
})
