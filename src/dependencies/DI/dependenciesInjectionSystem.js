const AutoAccessorInjectorEngine = require('../injector/autoAccessorInjectorEngine.js');
const FunctionInjectorEngine = require('../injector/functionInjectorEngine.js');
const ObjectInjectorEngine = require('../injector/objectInjectorEngine.js');
const MethodInjectorEngine = require('../injector/methodInjectorEngine.js');

const {property_metadata_t, metadata_t, metaOf} = require('reflectype/src/reflection/metadata.js');
const ClassInjectorEngine = require('../injector/classInjectorEngine.js');
const Contextual = require('./contextual.js');


/**
 * @typedef {import('../context/context.js')} Context
 * @typedef {import('reflectype/src/metadata/ReflectionParameter.js')} ReflectionParameter
 * @typedef {import('../component/componentContainer.js')} ComponentContainer
 */


class DependencyKind {

    static get FUNCTION() {

        return 1;
    };

    static get CLASS() {

        return 2;
    }

    static get FIELD() {

        return 3;
    }

    static get OBJECT() {

        return 4;
    }

    static get UNKNOWN() {

        return 0;
    }
}

function classifyMethodsOf(_object) {

    return function(_key) {

        if (_key === 'constructor') {

            return false;
        }

        const prop = _object[_key];
        /**@type {property_metadata_t?} */
        const propMeta = metaOf(prop);

        return typeof prop === 'function' && propMeta?.constructor === property_metadata_t && propMeta.isMethod === truw && Array.isArray(propMeta.defaultParamsType) && propMeta.defaultParamsType.length > 0;
    }
}



module.exports = class DependenciesInjectionSystem extends Contextual{

    /**@type {FunctionInjectorEngine} */
    #functionInjector;
    /**@type {AutoAccessorInjectorEngine} */
    #fieldInjector;
    /**@type {ObjectInjectorEngine} */
    #objectInjector;
    /**@type {ClassInjectorEngine} */
    #classInjector;
    /**@type {MethodInjectorEngine} */
    #methodInjector;

    #container;

    get componentContainer() {

        return this.#container;
    }

    /**@type {boolean} */
    get #fullyInject() {

        return this.global.fullyInject;
    }
    /**
     * 
     * @param {ComponentContainer} _compoentContainer 
     */
    constructor(_globalContext) {

        super(...arguments);

        this.#init();
    }

    #init() {

        const container = this.#container = this.global.components.container;

        this.#functionInjector = new FunctionInjectorEngine(container);
        this.#objectInjector = new ObjectInjectorEngine(container);
        //this.#fieldInjector = new AutoAccessorInjectorEngine(container);
        this.#classInjector = new ClassInjectorEngine(container);
        this.#methodInjector = new MethodInjectorEngine(container);
    }

    /**
     * 
     * @param {Object} _unknown 
     * @param {string || Symbol} method
     * @returns 
     */
    inject(_unknown, {method, context} = {}) {

        const kind = this.#classify(_unknown);

        const scope = context?.scope;
        
        switch (kind) {
            case DependencyKind.UNKNOWN: return;
            case DependencyKind.FIELD: return;
            case DependencyKind.FUNCTION: return this.#resolveFunction(_unknown, scope);
            case DependencyKind.CLASS: return this.#resolveClass(_unknown, scope);
            case DependencyKind.OBJECT: {

                if (method) {

                    return this.#resolveMethod(_unknown, method, scope)
                }
                else {

                    return this.#resolveObject(_unknown, scope);
                }
            };
            default: return;
        }
    }

    /**
     * 
     * @param {Object} _object 
     * @param {Function | String | Symbol} _method 
     * @param {Context?} _context 
     * @returns 
     */
    invoke(_object, _method, _context) {

        const actualFunction = this.#verifyAndResolveMethod(_object, _method);

        const injector = this.#functionInjector;

        const scope = _context?.scope;

        const args = injector.resolveComponentsFor(actualFunction, scope) ?? [];

        if (this.#hasAsyncArgument(args)) {

            return this.#invokeAsync(actualFunction, _object, args);
        }
        else {

            return actualFunction.call(_object, ...args);
        }
    }

    #hasAsyncArgument(_args) {

        for (const arg of _args || []) {

            if (arg instanceof Promise) {

                return true;
            } 
        }

        return false;
    }

    /**
     * 
     * @param {Function} _func 
     * @param {Context} _context 
     */
    resolveArguments(_func, _context) {

        const injector = this.#functionInjector;

        const args = injector.resolveComponentsFor(_func, _context.scope) ?? [];

        if (this.#hasAsyncArgument(args)) {
            
            return Promise.resolve(args);
        }
        else {
            
            return args;
        }
    }

    /**
     *  when a funtionn argument needs async component,
     *  it has to await for the asyn argument to be resolved
     *  then invoke it
     * 
     * @param {Funtion} _func 
     * @param {any} _this 
     * @param {Iterable} _args 
     * @returns 
     */
    async #invokeAsync(_func, _this, _args = []) {
        
        const args = [];

        for await (const currentArg of _args) {
    
            args.push(currentArg);
        }
    
        // if the invoked function is async, just unwrap the return value
        return await _func.call(this, ...args);
    }

    /**
     * async generator
     * 
     * @param  {...any} list 
     */
    async #await(...list) {

        return list;
    }

    #verifyAndResolveMethod(_object, _method) {

        const type = typeof _method;

        if (type === 'string' || type === 'symbol') {

            if (typeof _object !== 'object') {

                throw new Error('invalid arguments');
            }

            theMethod = _object[_method];

            if (typeof theMethod !== 'function') {

                throw new Error('invalid arguments');
            }
            else {

                return theMethod;
            }
        }
        else if (type === 'function') {

            return _method;
        }

        throw new Error('invalid arguments');
    }

    #classify(_unknown) {

        if (typeof _unknown === 'function') {

            /**@type {metadata_t | property_metadata_t} */
            const meta = metaOf(_unknown);

            if (meta?.constructor === metadata_t) {

                return DependencyKind.CLASS;
            }
            else if (meta?.constructor === property_metadata_t && meta.isMethod) {

                return DependencyKind.FUNCTION;
            }
            else {

                return DependencyKind.UNKNOWN;
            }
        }
        else if (typeof _unknown === 'object') {

            return DependencyKind.OBJECT;
        }

        return DependencyKind.UNKNOWN;
    }

    /**
     * Inject Static Property
     * 
     * @param {Function} _class 
     */
    #resolveClass(_class) {

        const injector = this.#classInjector;

        injector.inject(_class)
    }

    #resolveObject(_object, _scope) {

        const injector = this.#objectInjector;
        
        injector.inject(_object, _scope);

        if (this.#fullyInject) {

            this.#traceMethodsAndInject(_object, _scope);
        }
    }

    #resolveFunction(_func, _scope) {
        
        const injector = this.#functionInjector;

        injector.inject(_func, _scope);
    }

    #resolveMethod(_object, _methodName, _scope) {
        
        this.#methodInjector.inject(_object, _methodName, _scope);
    }

    #traceMethodsAndInject(_object, _scope) {

        const methods = Reflect.ownKeys(_object)
                        .filter(classifyMethodsOf(_object));

        for (const methodName of methods || []) {

            this.#resolveMethod(_object, methodName, _scope);
        }
    }
}