const PreInvokeFunction = require('./src/callback/preInvokeFunction.js');
const controller = require('./src/controller/baseController.js')
const decorator = require('./src/decorator/decoratorResult.js');
const http = require('./src/http/httpRouting.js');
const middleware = require('./src/middleware/middleware.js');
const response = require('./src/response/responseResult.js');
const baseController = require('./src/controller/baseController.js');
const requestDispatcher = require('./src/requestDispatcher.js');
const responseDecorator = require('./src/response/decorator.js');


const ioc = require('./src/ioc/decorator.js');
const request = require('./src/request/decorator.js');
const actionResults = {
    ...require('./src/response/utils/view.js'),
    ...require('./src/response/utils/redirect.js'),
    ...require('./src/response/utils/fileResult.js'),
    ...require('./src/response/utils/download.js'),
};



module.exports = {
    PreInvokeFunction , 
    ...controller, 
    ...decorator, 
    ...http, 
    ...middleware, 
    response, 
    ...baseController, 
    ...requestDispatcher, 
    ...responseDecorator,
    ...actionResults,
    ...request,
    ...ioc
};