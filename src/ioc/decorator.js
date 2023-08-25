//const {BaseController} = require('../controller/baseController.js');
const IocContainer = require('./iocContainer.js');
const {preprocessDescriptor} = require('../decorator/utils.js');
const ControllerComponentManager = require('../controller/controllerComponentManager.js');
const reflectClass = require('../libs/reflectClass.js');
const {EventEmitter} = require('node:events');
const ControllerState = require('../controller/controllerState.js');

const { BaseController } = require('../controller/baseController.js');
const ControlerState = require('../controller/controllerState.js');
const ControllerConfiguration = require('../controller/controllerConfiguration.js');

/**
 *  @readonly
 *  @enum {string}
 */
class BindType {

    /**
     *  @returns {string}
     */
    static get SINGLETON() {

        return 'singleton';
    }
    
    /**
     *  @returns {string}
     */
    static get SCOPE() {

        return 'scope';
    }

    /**
     *  @returns {string}
     */
    static get TRANSIENT() {

        return 'transient';
    }
}

class IocContainerBindScopeInterfaceError extends Error {

    constructor() {

        super('The IocContainer does not have bindScope() Method');
    }
}

class BindingContext {

    /**
     *  @type {IocContainer}
     */
    static #currentIocContainer;

    /**
     *  @type {boolean}
     */
    static #isFixedContext = false;

    /**
     *  @type {Object}
     */
    static #Component = {};
    static #componentMap = new WeakMap();

    static #bindingHooks = [];

    /**
     *  @type {Object}
     */
    static #currentComponent;

    /**
     * 
     * @returns {Array}
     */
    static getBindingHooks() {

        return this.#bindingHooks;
    }

    /**
     * 
     * @param  {...Function} hooks 
     * 
     * @throws
     */
    static addHook(...hooks) {

        if (!this.#currentComponent) {

            throw new Error('Dependency injection error: You must @autoBind the class before use @is to inject properties');
        }

        hooks.forEach((_callback) => {

            if (typeof _callback != 'function') {

                throw new Error('passing argument that is not type of function to BindingContext.addHook() is not be allowed')
            }

            if (_callback.constructor.name == 'AsyncFunction') {

                throw new Error('BindingContext.addHook() does not accept async function');
            }
        })

        if (!this.#bindingHooks) {

            this.#bindingHooks = [];
        }

        this.#bindingHooks.push(...hooks);
    }

    /**
     * 
     * @param {Symbol} symbol 
     */
    static bindComponent(symbol) {

        this.#Component[symbol] = 1;

        //this.#bindingHooks = [];

        this.#currentComponent = symbol;
    }

    /**
     *  @type {Object}
     */
    static get currentComponent() {

        return this.#currentComponent;
    }

    /**
     * 
     * @param {Symbol} symbol 
     * @param {Object} concrete 
     * 
     * @returns {undefined}
     */
    static assignComponent(symbol, concrete) {

        if (!this.#Component[symbol]) return;

        this.#Component[symbol] = concrete;

        this.#componentMap.set(concrete, 1);

        const bindingHooks = this.#bindingHooks;


        if (Array.isArray(bindingHooks)) {

            this.#currentIocContainer.hook.add(concrete, ...bindingHooks);
        }
        //this.#hooks.add()
    }

    /**
     * 
     * @param {Symbol} symbol 
     * @returns 
     */
    static getBindComponentBySymbol(symbol) {

        return this.#Component[symbol];
    }
    
    /**
     *  @returns {boolean}
     */
    static get isFixedContext() {

        return this.#isFixedContext;
    }

    /**
     * 
     * @param {IocContainer} _iocContainer 
     */
    static fixedContext(_iocContainer) {

        this.#checkFixedContext();

        this.switchContext(_iocContainer);

        this.#isFixedContext = true;
    }

    static #checkFixedContext() {

        if (this.#isFixedContext) {

            throw new Error('Binding Error: the context of autoBind decorator is fixed, so you cannot not switch to another context');
        }
    }

    /**
     * 
     * @param {IocContainer} _iocContainer 
     */
    static switchContext(_iocContainer) {

        this.#checkFixedContext();

        if (!(_iocContainer instanceof IocContainer)) {

            throw new Error('autoBind Error: invalid ioc container');
        }

        this.#currentIocContainer = _iocContainer;
    }

    static endContext() {

        this.#currentComponent = undefined;
        this.#bindingHooks = undefined;

        if (this.#isFixedContext) return;

        this.#currentIocContainer = undefined;
    }

    /**
     * 
     * @returns {IocContainer}
     */
    static currentContext() {

        const context = this.#currentIocContainer;

        if (!context) {

            throw new Error('Binding Context Error: your class is not bound or you are not in FixedContext.')
        }

        return context
    }
}

function resovleConstructorArguments(_constructor, _iocContainer, _controllerState) {

    if (_iocContainer._isParent(BaseController, _constructor)) {

        // ControllerState is bound as Transient by default
        if (!(_controllerState instanceof ControlerState)) {

            //const config = _iocContainer.get(ControllerConfiguration);

            _controllerState = _iocContainer.get(ControlerState);
            //_controllerState = new ControlerState(config);
        }
    }

    const iocContainerHasResolveArgumentsMethod = _iocContainer.resolveArgumentsOf;

    const constructorArgs = (iocContainerHasResolveArgumentsMethod) ? _iocContainer.resolveArgumentsOf(_constructor, _controllerState) : [undefined];

    return [constructorArgs, _controllerState];
}

/**
 * 
 * @param {BindType} _type 
 * @param {boolean} _resolvePropertyWhenInstantiate 
 * @param {IocContainer} _iocContainer 
 * @returns 
 */
function autoBind(_type = BindType.TRANSIENT, _resolvePropertyWhenInstantiate = true, _iocContainer) {
    
    if (BindingContext.currentComponent) {

        throw new Error('applying @autoBind multiple times is not allowed');
    }

    if (!BindingContext.isFixedContext) {

        if (_iocContainer instanceof IocContainer) {

            BindingContext.switchContext(_iocContainer);
        }
    }
    else {

        _iocContainer = BindingContext.currentContext();
    }

    const symbol = Symbol(Date.now());

    BindingContext.bindComponent(symbol);

    return function(_constructor) {

        try {

            const bindingHooks = BindingContext.getBindingHooks() || [];

            const Component = class extends _constructor {

                static #realName = _constructor.name;
                #realClassName = _constructor.name;
                #hookedComponents = [];
                #constructorParams;
                
                get constructorParams() {

                    return this.#constructorParams;
                }

                static get realName() {

                    return this.#realName;
                }

                get realClassName() {

                    return this.#realClassName;
                }

                get isDecoratedComponent() {

                    return true;
                }

                constructor() {

                    const [constructorArgs, controllerState] = resovleConstructorArguments(_constructor, _iocContainer);

                    super(...constructorArgs);

                    this.#handleIfController(controllerState);

                     // some properties of BaseController need http context to be resolve properly
                    // Controller only been resolve by dispatchRequest()
                    if (_resolvePropertyWhenInstantiate) {

                        this.resolveProperty();
                    }
                }

                #handleIfController(_controllerState) {

                    const thisClass = this.constructor;

                    if (!_iocContainer._isParent(BaseController, thisClass)) return;

                    super.setState(_controllerState);
                }


                pushDecoratedProp(decoratedResult) {
        
                    this.#hookedComponents.push(decoratedResult);
                }

                resolveProperty() {

                    if (super.resolveProperty) {

                        super.resolveProperty();
                    }

                    if (!this.#hookedComponents) return;
                    
                    for (const propertyDecorator of this.#hookedComponents) {

                        if (propertyDecorator instanceof PropertyDecorator) {
            
                            propertyDecorator.bind(this).resolve();
                        }
                    }

                    this.#hookedComponents = undefined;
                }
            }

            switch(_type) {
                /**
                 *  in this section
                 *  we need to bind both the wrap Component and the exact class
                 *  in order to implement constructor and method injection
                 *  because *method injection base on reflection which works mostly with string
                 *  therefore, bind the exact class helps detemining the component correctly
                 */
                case BindType.TRANSIENT:
                    _iocContainer.bind(Component, Component);
                    _iocContainer.bind(_constructor, Component);
                    break;
                case BindType.SCOPE:
                    _iocContainer.bindScope(Component, Component);
                    _iocContainer.bindScope(_constructor, Component);
                    break;
                case BindType.SINGLETON:
                    _iocContainer.bindSingleton(Component, Component);
                    _iocContainer.bindSingleton(_constructor, Component);
                    break;
            } 

            BindingContext.assignComponent(symbol, Component);

            BindingContext.endContext();

            return Component;
        }
        catch(error) {
            
            if (error instanceof TypeError && error.message.match(/bindScope is not a function/) != null) {

                //throw new Error('autoBind Error: the passed ioc container does not have bindScope() method');
                throw new IocContainerBindScopeInterfaceError()
            }
            else {

                throw error;
            }   
        }    
    }
}

function is(_component) {

    const iocContainer = BindingContext.currentContext();

    const currentComponentSymbol = BindingContext.currentComponent;

    if (!iocContainer) {

        throw new Error('Property Binding Error: your class is not bind with an ioc container'); 
    }

    if (!currentComponentSymbol) {

        throw new Error('Dependency injection error: You must @autoBind the class before use @is to inject properties');
    }

    return function(_target, _prop, descriptor) {
        
        const iocContainer = BindingContext.currentContext();
        
        let setter;

        if (_target.isPseudo && descriptor.private) {


            setter = descriptor.set;
        }

        function injectProperty() {

            const state = this.state || undefined;

            const propName = _prop;
            
            const componentInstance = iocContainer.get(_component, state);

            if (componentInstance) {
        
                if (setter) {
        
                    return setter.call(this, componentInstance);
                }
                
                this[propName] = componentInstance;
        
                return;
            }
            else {
        
                const componetName = (typeof _component == 'string') ? _component : componentInstance.name;
        
                throw new Error(`Binding Error: cannot find ${componetName}`)
            }
        }

        BindingContext.addHook(injectProperty);

        return descriptor;
    }
}

module.exports = {autoBind, BindType, is, BindingContext, };