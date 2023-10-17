const ReflectionFunction = require('reflectype/src/metadata/reflectionFunction.js');
const Void = require('reflectype/src/type/void.js');
const {metaOf, property_metadata_t} = require('reflectype/src/reflection/metadata.js');
const Context = require('../context/context.js');

const Contextual = require('../DI/contextual.js');
const Injector = require('./injector.js');

/**
 * @typedef {import('../context/context.js')} Context
 * @typedef {import('reflectype/src/metadata/ReflectionParameter.js')} ReflectionParameter
 */

module.exports = class FunctionInjectorEngine extends Injector {

    constructor(_context) {

        super(...arguments);
    }

    /**
     * 
     * @param {Function} _func 
     */
    #preprocessFunction(_func) {

        /**@type {property_metadata_t}*/
        const funcMeta = metaOf(_func);

        const funcDefaultParams = funcMeta.value;

        funcMeta.value ??= new Array(reflection.parameters.length);

        funcMeta.value = Array.isArray(funcDefaultParams) ? funcMeta.value : [funcDefaultParams];
    }
    
    /**
     * 
     * @param {Function} _func 
     * @returns {Array}
     */
    #prepareDummyArguments(_func) {

        //const reflection = new ReflectionFunction(_func);

        /**@type {property_metadata_t} */
        const funcMeta = metaOf(_func);

        if (!meta) {

            return [];
        }

        const defaultArgs = funcMeta.value;

        const parameters = funcMeta.defaultParamsType;

        const difference = parameters.length - defaultArgs.length;

        const missingCount = (difference >= 0) ? difference : 0;
        // this line would cause error
        return [...funcMeta.value, ...Array(missingCount)];
    }

    #ensureFunction(_unknown) {

        if (typeof _unknown !== 'function') {

            throw new TypeError(`cannot inject to ${typeof _unknown}`);
        }
    }

    /**
     * 
     * @param {Function} _func 
     * @param {Array} args 
     * @returns 
     */
    #setDefaultArguments(_func, args = []) {

        const typeMeta = metaOf(_func);

        if (!typeMeta || !Array.isArray(args)) {

            return false;
        }        

        typeMeta.value = args;
    }

    #resolveComponentsFor(_func) {

        const reflection = new ReflectionFunction(_func);

        const parameters = reflection.parameters;

        const ret = this.#prepareDummyArguments(_func);

        let i = 0;

        const iterator = parameters.values();
        let param = iterator.next();

        while (!param.done) {

            /**@type {ReflectionParameter} */
            const paramReflection = param.value;

            const paramType = paramReflection.type;

            if (paramType !== undefined && paramType !== null && paramType !== Void) {

                const component = this.iocContainer.get(paramType);

                ret[i] = component ?? ret[i];
            }

            ++i;
            param = iterator.next();
        }

        return ret;
    }

    inject(_function) {

        this.#ensureFunction(_function);

        const reflection = new ReflectionFunction(_function);

        if (!reflection.isValid) {

            return;
        }

        /**@type {property_metadata_t}*/
        const funcMeta = metaOf(_function);

        this.#preprocessFunction(_function);

        const args = this.#resolveComponentsFor(_function);

        this.#setDefaultArguments(_function, args);
    }
}