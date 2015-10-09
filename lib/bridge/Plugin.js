var Observable = require('vjs/lib/observable')
Observable.prototype.inject(
  require('vjs/lib/methods/plain')
)
var BridgeObservable = require('./BridgeObservable')
var bridge = require('./')

var Plugin = new Observable({
  on: {
    new: function () {
      bridge.registerPlugin(this)
    },
    bridge: {
      condition: function (data, next, event) {
        var self = this
        bridge.send(this.key, 'set', this.plain(), function (err) {
          if (err) {
            console.error('Oh no', err)
            self.emit('error', err, event)
          } else {
            next()
          }
        })
      }
    }
  },
  ChildConstructor: BridgeObservable
}).Constructor

Plugin.prototype.inject(
  require('vjs/lib/methods/setWithPath')
)

module.exports = exports = Plugin
