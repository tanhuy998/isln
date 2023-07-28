const {WS, WSController} = require('../../index.js');
const {args, autoBind, ApplicationContext} = require('../../index.js');
const ResponseError = require('../../src/error/responseError.js');

@autoBind()
class Component {

    prop = '1';
}

//@WS.channel('prefix')
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
    @args(Component)
    async handle(component) {

        console.log(component)
        
        console.log('test event')

        throw new Error('test error decorator')

        return 1;
    }


    @args(Error)
    onError(error) {

        console.log('default error handler', this.error);

        throw new Error('passed through default error handler');
    }

    @WS.handleError
    @args(Component)
    handleError(component) {

        console.log(component)

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
