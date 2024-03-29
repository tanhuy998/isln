const PhaseError = require("../errors/pipeline/phaseError");
const Payload = require("./payload/pipelinePayload.js");
const PhaseBuilder = require("./phase/phaseBuilder");
const PipelineController = require("./controller/pipelineController");
const ErrorController = require('./controller/errorController.js');
const ErrorPhaseBuilder = require("./phase/errorPhaseBuilder");
const self = require("reflectype/src/utils/self");
const Breakpoint = require('./payload/breakpoint.js');
const ContextLockable = require("../lockable/contextLockable.js");
const ErrorTracer = require("./errorTracer.js");


/**
 * @typedef {import('../context/context.js')} Context
 * @typedef {import('../../libs/linkedList.js').T_WeakTypeNode} T_WeakTypeNode
 * @typedef {import('./phase/phase.js')} Phase
 * @typedef {import('../handler/errorHandler.js')} ErrorHandler
 * @typedef {import('../handler/contextHandler.js')} ContextHandler
 */

/**
 *  Pipeline Manage phases and errors handler.
 *  when a context arrived, pipeline initiates a PipelineController
 *  and then dispatches the context as payload to it
 */
module.exports = class Pipeline extends ContextLockable{

    static lockActions = ['pipe', 'pipeError', 'addPhase', 'onError'];

    /**@type {number} */
    static #maxSyncTask = 100;

    /**@returns {number} */
    static get maxSyncTask() {

        return this.#maxSyncTask;
    }

    /**@type {Phase<ContextHandler | Function>} */
    #firstPhase;

    /**@type {Phase<ErrorHandler | Function>} */
    #errorHandler;

    /**@type {typeof Context} */
    #global

    /**@type {number} */
    #maxSync;

    /**@returns {number} */
    get maxSyncTask() {

        return this.#maxSync;
    }

    set maxSyncTask(_number) {

        if (_number <= 0) {

            throw new Error('max sync task of pipeline must be greater than 0');
        }

        this.#maxSync = _number;
    }

    /**@returns {Phase<ErrorHandler | Function>} */
    get errorHandler() {

        return this.#errorHandler;
    }

    /**@returns {Phase<ContextHandler | Function>} */
    get firstPhase() {

        return this.#firstPhase;
    }

    /**@returns {typeof Context} */
    get global() {

        return this.#global;
    }

    /**@returns {boolean} */
    get isBlock() {

        return this.#global === undefined || this.#global === null ? false : true;
    }

    constructor(_globolContext) {

        super(_globolContext);

        this.#global = _globolContext;

        this.#init();
    }

    #init() {

        this.#maxSync = self(this).maxSyncTask;
    }

    /**
     * 
     * @param {Phase<ContextHandler | Function>} _phase 
     * @returns {Pipeline}
     */
    pipe(_phase) {

        const firstPhase = this.#firstPhase;

        _phase.join(this);

        if (firstPhase === undefined || firstPhase === null) {
            
            this.#firstPhase = _phase;

            return;
        }

        this.#firstPhase.pushBack(_phase);

        return this;
    }
    
    /**
     * 
     * @param {Phase<ErrorHandler | Function>} _phase 
     * @returns {Pipeline}
     */
    pipeError(_phase) {

        const firstPhase = this.#errorHandler;

        _phase.join(this);
        
        if (firstPhase === undefined || firstPhase === null) {
            
            this.#errorHandler = _phase;

            return;
        }

        this.#errorHandler.pushBack(_phase);

        return this;
    }

    /**
     * 
     * @returns {PhaseBuilder}
     */
    addPhase() {

        return new PhaseBuilder(this);
    }

    /**
     * 
     * @param {Context} _context 
     * @param {Payload} _payload 
     * @returns 
     */
    run(_context, _payload) {
        
        if (this.#global && this.#global !== _context.global) {

            return;
        }
        
        const controller = new PipelineController(this);
        
        const payload = _payload instanceof Payload ? _payload : new Payload(_context, controller, this);

        //console.time(payload.id);

        controller.setPayload(payload);

        return controller.startHandle();
    }

    /**
     * 
     * @param {Payload} _payload 
     * @param {any} _error 
     */
    catchError(_payload, _error) {
        
        if (_payload.pipeline !== this) {

            return;
        }

        const errorTracer = new ErrorTracer(_payload, _error);

        _error = errorTracer.errorToHandle;

        const errorController = new ErrorController(this);

        const breakpoint = new Breakpoint(_payload.context, errorController, this, _payload);

        breakpoint.trace.push(_error);
        
        breakpoint.setOriginError(_error);

        errorController.setPayload(breakpoint);

        this.#overrideContextErrorsComponents(_payload.context, breakpoint, _error);
        
        return errorController.startHandle();
    }

    /**
     * 
     * @param {Context} _context
     * @param {Breakpoint} _breakPoint 
     * @param {any} _error 
     */
    #overrideContextErrorsComponents(_context, _breakPoint, _error) {

        const contextScope = _context.scope;

        contextScope.override(Breakpoint, Breakpoint, {
            defaultInstance: _breakPoint
        })

        if (_error instanceof Error) {

            contextScope.override(Error, Error, {
                defaultInstance: _error
            })
        }
    }
    
    /**
     * 
     * @param {...(Function | ErrorHandler)} _handler 
     */
    onError(..._handler) {

        _handler = _handler.flat(Infinity);

        for (const handler of _handler) {
            
            new ErrorPhaseBuilder(this).setHandler(handler).build();
        }
    }

    

    /**
     * 
     * @param {PhaseError} error 
     * @param {Context} payload 
     * 
     * @return {boolean}
     */
    #isValidError(error, payload) {

        const {phase, pipeline, context} = error;

        if (pipeline !== this) {

            return false;
        }

        if (context?.global !== payload.global) {

            return false;
        }

        let ownPhase = this.#firstPhase;

        while(ownPhase !== undefined && ownPhase !== null) {

            if (ownPhase === phase) {

                return true;
            }

            ownPhase = ownPhase.next;
        }

        return false;
    }   

    /**
     * 
     * @param {PipelineController} _controller 
     */
    approve() {

        if (_controller.pipeline !== this) {

            return;
        }

        const payload = _controller.payload;

        //console.timeEnd(payload.id);
    }
}