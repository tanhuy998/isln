const {BaseController, routingContext, Route, Endpoint, responseBody, Middleware, requestParam, autoBind} = require('../../index.js');
//const { autoBind } = require('../../src/ioc/decorator.js');

function log(req, res, next) {

    console.log('admin')
    //res.end();
    next();
}

Route.constraint()
    .group('/test')
    .before(log)
    .apply()

@Middleware.after(log)
@Route.group('/messure')
@Route.group('/test')
//@Route.group('/new')
@routingContext()
@autoBind()
class Controller2 extends BaseController {

    @requestParam('userId')
    id;

    constructor() {

        super();
    }

    @Endpoint.GET('/index')
    @responseBody
    index(a, b) {

        return 'Hello on Admin section!';
    }

    //@Middleware.before(log)
    @Endpoint.GET('/data/:userId')
    @responseBody
    getData() {

        const req = this.httpContext.request;
        const res = this.httpContext.response;
        
        console.log('No Authentication');
        //this.httpContext.nextMiddleware();

        const id = this.id;
        console.log(id);

        if (!req.user) {
            
            res.status(403);
            
            //console.log('no auth', res.headersSent);
            //this.httpContext.nextMiddleware();
            return 'No Authentication';
        }
        
        return 'Nothing to retrieve';
    }

}

module.exports = Controller2;