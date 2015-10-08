'use strict'

var BridgeObservable = require('../../../../lib/bridge/BridgeObservable')
var bridge = require('../../../../lib/bridge')
var customPlatform = require('../../../helpers/customPlatform')

bridge.platform = customPlatform

var Plugin
var name = 'some-plugin'
var plugin

describe('Plugin', function () {
  it('should be requireable', function () {
    Plugin = require('../../../../lib/bridge/Plugin')
    expect(typeof Plugin).to.equal('function')
  })

  it('should be instantiatable', function () {
    sinon.spy(bridge, 'registerPlugin')
    plugin = new Plugin({
      key: name,
      x: {}
    })
    expect(plugin).instanceOf(Plugin)
    expect(plugin.key).to.equal(name)
  })

  it('should register itself with the bridge on instantiation', function () {
    expect(bridge.registerPlugin).calledOnce
  })

  it('should have BridgeObservable children', function () {
    expect(plugin.x).instanceOf(BridgeObservable)
  })

  describe('native events', function () {
    it('should forward the `ready` event', function () {
      var readySpy = sinon.spy()
      plugin.on('ready', readySpy)
      // Let's fake a ready event for this plugin
      window.vigour.native.bridge.ready(null, 'message 1', name)
      window.vigour.native.bridge.ready(null, 'message 2')

      expect(readySpy).calledOnce
    })

    it('should forward pushed messages', function () {
      var receiveSpy = sinon.spy()
      plugin.on('receive', receiveSpy)
      // Let's fake a ready event for this plugin
      window.vigour.native.bridge.receive(null, 'message 1', name)
      window.vigour.native.bridge.receive(null, 'message 2')

      expect(receiveSpy).calledOnce
    })

    it('should send itself via the bridge when changed', function () {
      sinon.spy(bridge.platform, 'send')
      plugin.x.val = 'new value'
      setTimeout(function () {
        expect(bridge.platform.send).called
      }, 10)
    })
  })
  describe('incorrect usage', function () {
    it('should forward native `error` events', function () {
      var spy = sinon.spy()
      plugin.on('error', spy)

      // Let's fake a ready event for this plugin
      window.vigour.native.bridge.error('message 1', name)
      window.vigour.native.bridge.error('message 2')

      expect(spy).calledOnce
    })
  })
})