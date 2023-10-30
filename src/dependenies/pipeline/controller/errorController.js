const NoPhaseError = require("../../errors/pipeline/noPhaseError");
const { ROLL_BACK, ABORT_PIPELINE, DISMISS } = require("../constant");
const Breakpoint = require("../payload/breakpoint");
const isControlSignal = require("./isControlSignal");
const PipelineController = require("./pipelineController");

/**
 * @typedef {import('../payload/breakpoint')} ErrorPayload
 */


function generateNext() {

    function next(error) {

        throw error;
    }

    next.abort = function() {

        throw ABORT_PIPELINE;
    }

    next.rollback = function() {

        throw ROLL_BACK;
    }
    
    next.dismiss = function() {

        throw DISMISS;
    }

    return next;
}

/**
 *  ErrorController inherits lots of PipelineController feature.
 *  Excepts the promise returned by startHandle() method always resolves the Breakpoint object
 *  which is generated by the pipeline.
 *  The trace() method will check if the value returned by it's handler is a control signal to stop
 *  the handling progression.
 */
module.exports = class ErrorController extends PipelineController {

    /**
     * @return {BreakPoint}
     */
    get payload() {

        return super.payload;
    }

    get firstPhase() {

        return this.pipeline.errorHandler;
    }

    constructor(_pipeline) {

        super(...arguments);
    }

    async startHandle() {

        try {

            return await super.startHandle([generateNext()]);
        }
        catch (error) {
            /**
             *  PipelineController would throw a NoPhaseError when there is no phases were registered to the pipeline,
             *  ErrorHandler will catch this and just resolve the the breakpoint, letting the PipelineController makes decision.
             */
            if (error instanceof NoPhaseError) {

                /**@type {Breakpoint} */
                const breakpoint = this.payload;

                return breakpoint;
            }
            else {

                throw error;
            }
        }
    }

    setPayload(_breakPoint) {

        if (!(_breakPoint instanceof Breakpoint)) {

            throw new TypeError('ErrorController.setPayload() need an instance of [Breakpoint]');
        }

        return super.setPayload(_breakPoint);
    }

    /**
     * 
     * @param {ErrorPayload} _breakPoint 
     * @param {*} param1 
     */
    trace(_breakPoint, _info = {}) {

        const {currentPhase, occurError, value, opperator} = _info;

        if (occurError === false || isControlSignal(value)) {
            
            _breakPoint.trace.push(value);

            this.event.emit('resolve', _breakPoint);

            return;
        }
        else {
            
            _info.occurError = false;
        
            super.trace(...arguments);
        }
    }

    // #isControllSignal(value) {

    //     return [ABORT_PIPELINE, DISMISS, ROLL_BACK].includes(value);
    // }
}