'use strict'
var Observable = require('vigour-js/lib/observable')
var Emitter = require('vigour-js/lib/emitter')
var emit = Emitter.prototype.emit

const INIT = 'init'

exports.properties = {
  platform: new Observable({
    useVal: true,
    on: {
      error: {
        platform (data, event) {
          console.error('plugin error:', data)
        }
      },
      properties: {
        init: new Emitter({
          define: {
            emit (data, event) {
              var plugin = this.parent.parent.parent
              var initialised = plugin.initialised
              if (!initialised.val) {
                // TODO add error handler => initialised is false
                plugin.initialised.val = true
                plugin.loading.val = INIT
                plugin.ready.is(true, function () {
                  if (plugin.loading.val === INIT) {
                    plugin.loading.val = false
                  }
                })
                emit.apply(this, arguments)
              }
            }
          }
        })
      },
      ChildConstructor: new Emitter({
        define: {
          emit (data, event) {
            var platform = this.parent.parent
            var plugin = platform.parent
            var ready = plugin.ready
            if (ready.val) {
              emit.apply(this, arguments)
            } else {
              ready.once([(ready, event) => {
                emit.call(this, data, event, platform)
              }, this])
              platform.emit(INIT, data, event)
            }
          }
        }
      })
    }
  })
}
