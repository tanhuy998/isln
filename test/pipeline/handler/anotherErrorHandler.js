const ErrorHandler = require("../../../src/dependencies/handler/errorHandler");

module.exports = class AnotherErrorHandler extends ErrorHandler {

    accept = [String];

    handle() {

        console.log('another error handler', this.error);
    }
}