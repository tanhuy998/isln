const {WS, WSController, ActionResult} = require('../../index.js');
const {args, autoBind, ApplicationContext} = require('../../index.js');
const ResponseError = require('../../src/error/responseError.js');
const WSEvent = require('../../src/websocket/router/wsEvent.js');

const main = require('../../index.js');
const { consumes } = require('../../legacy.decorators.js');
//const { WSController, WSController } = require('../../stage3.js');

@autoBind()
class Component {

    prop = '1';
}


function test(socket, next) {

    console.log('interceptor');

    next();
}

//@WS.interceptor(test)
@WS.channel('prefix')
@WS.context()
class Controller1 extends WSController{

    constructor() {
        
        super();
    }

    // @WS.channel('test')
    // before() {

    //     const label = this.context.state.args;

    //     this.context.state.sender.label = label;

    //     //console.time(label);
    // }

    @WS.channel('test')
    @args(Component, WSEvent)
    async handle(component, event) {
        
        const eventArgs = this.context.eventArguments;
        return {status: 'ok'};
    }

    @args(Error)
    onError(error) {

        console.log('default error handler', error.message);

        throw new Error('passed through default error handler');
    }

    @WS.handleError
    @args(Component, Error)
    handleError(component, e) {

        console.log(component, e.message)

        const error = this.error;

        console.log(error.message);

        return error;
    }


    // @WS.channel('test') 
    // after() {


    //     const label = this.context.state.sender.label;

    //     //console.log(args[0] || undefined);
    //     //console.timeEnd(label);
    //     //return 'ok2';
    // }
}

module.exports = Controller1;
