var Observable = require('vjs/lib/observable')
var BridgeObservable = require('./BridgeObservable')
var bridge = require('./')

var Plugin = new Observable({
  on: {
    new: function () {
      bridge.registerPlugin(this)
    },
    bridge: {
      condition: function (next, event, condition, meta) {
        bridge.send(this.key, 'set', this.convert({ plain: true }), function (err) {
          if (err) {
            condition.cancel(err)
          } else {
            next()
          }
        })
      }
    }
  },
  ChildConstructor: BridgeObservable
}).Constructor

module.exports = exports = Plugin
