const WebsocketContext = require('./websocketContext.js');
const context = require('./decorators/context.js');
const channel = require('./decorators/channel.js');
const filter = require('./decorators/filter.js');
const namespace = require('./decorators/namespace.js');
const handleError = require('./decorators/handleError.js');
const interceptor = require('./decorators/interceptor.js');

const WS = new Proxy({
    resolve: function() {

        WebsocketContext.resolve();
    },
    server: function(_io) {

        WebsocketContext.setServer(_io);
    },
    namespace: namespace,
    context: context,
    channel: channel,
    filter: filter,
    handleError: handleError,
    interceptor: interceptor
}, {
    get: function(target, prop) {

        let theProp = target[prop];

        if (theProp instanceof Function) {

            theProp = theProp.bind(target);
        }

        return theProp;
    },
    set: () => {

        return false;
    }
})

module.exports = WS;