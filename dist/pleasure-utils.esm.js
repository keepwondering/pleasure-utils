/*!
 * pleasure-utils v1.0.0-beta
 * (c) 2018-2019 undefined
 * Released under the MIT License.
 */
import path$1 from 'path';
import fs, { existsSync } from 'fs';
import util from 'util';
import castArray from 'lodash/castArray';
import each from 'lodash/each';
import Promise from 'bluebird';
import { EventEmitter } from 'events';
import merge from 'deepmerge';
import get from 'lodash/get';

/**
 * Returns a random unique id.
 *
 * @ignore
 * @see {@link https://stackoverflow.com/a/6860962/1064165}
 * @return {String} - Random unique id generated.
 */
function randomUniqueId () {
  const randLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return randLetter + Date.now()
}

function findPackageJson (dir) {
  dir = dir || path$1.resolve(process.cwd(), process.env.PLEASURE_ROOT || './');
  const local = path$1.join(dir, 'package.json');
  if (!existsSync(local)) {
    // todo: fix for different platforms
    if (local === '/') {
      return
    }

    return findPackageJson(path$1.join(dir, '../'))
  }

  return local
}

/**
 * Finds the root of a project (where the `pleasure.config.js` resides).
 *
 * @function Utils.findRoot
 * @param {...String} [paths] - Optional resolve the given path(s) from the root.
 *
 * @return {String} The path to the project. When given extra arguments, it will resolve those as paths from the
 * found root.
 *
 * @example <caption>Returning the location to the package.json file</caption>
 *
 * e.g. imaging running the code below from a project at path `/Users/tin/my-kick-ass-project`
 *
 * ```js
 * // prints: /Users/tin/my-kick-ass-project/package.json
 * console.log(findRoot('package.json'))
 * ```
 */
function findRoot (...paths) {
  return path$1.resolve(process.env.PLEASURE_ROOT || path$1.dirname(findPackageJson()), ...paths)
}

/**
 * Locates the pleasure.config.js file
 * @ignore
 */
function findConfig () {
  return findRoot('pleasure.config.js')
}

function packageJson () {
  const file = findRoot('./package.json');

  if (!fs.existsSync(file)) {
    return {}
  }

  return require(file)
}

const readdirAsync = util.promisify(fs.readdir);

/**
 * Deep scans the given `directory` returning an array with strings to all of the files found in that `directory`.
 *
 * @param {String} directory - The directory to scan
 * @param {String[]|RegExp[]} [exclude=[/node_modules/]] - Paths to exclude
 * @param {Function} [filter] - Callback function called with the evaluated `path` as the first argument. Must return
 * `true` or `false`
 * @return {Promise<String[]>} Paths found
 */
async function deepScanDir (directory, { exclude = [/node_modules/], filter } = {}) {
  const files = await readdirAsync(directory);
  // console.log({ files })
  let found = [];

  await Promise.each(files, async file => {
    file = path.join(directory, file);

    const isDirectory = (await lstat(file)).isDirectory();

    if (!isDirectory && filter && !await filter(file)) {
      return
    }

    let excluded = false;

    each(castArray(exclude), pattern => {
      if (typeof pattern === 'string' && file.indexOf(pattern) >= 0) {
        excluded = true;
        return false
      }

      if (pattern instanceof RegExp && pattern.test(file)) {
        excluded = true;
        return false
      }
    });

    if (excluded) {
      return
    }

    if (isDirectory) {
      found = found.concat(await deepScanDir(file, { exclude, filter }));
      return
    }

    found.push(file);
  });

  return found
}

let singleton;

function eventsBus () {
  if (singleton) {
    return singleton
  }

  const PleasureMainEvent = new EventEmitter();

  const api = {};
  const evs = ['on', 'removeListener', 'once', 'emit'];

  evs.forEach(ev => {
    if (ev in PleasureMainEvent) {
      api[ev] = PleasureMainEvent[ev].bind(PleasureMainEvent);
    }
  });

  singleton = api;

  return singleton
}

const middlewares = {};

/**
 * Extends a configuration scope
 *
 * @param {String} scope - Scope to extend
 * @param {Function|Object} replacement - Either an object to merge with the local configuration, or a function that
 * will get called per configuration request and must return an object to merge with local found scope.
 *
 * @example <saption>Overriding a scope</caption>
 *
 * ```js
 * // forces to assign 4000 as the value of port in the api scopes
 * extendConfig('api', { port: 4000 })
 *
 * // will return { api: { xxx: 'xvalue', port: 4000, yyy: 'yvalue' }, ui { ... } }
 * getConfig()
 * ```
 */
function extendConfig (scope = '', replacement) {
  if (!scope || !replacement) {
    return console.error(`provide both a scope & replacement`)
  }

  if (!middlewares.hasOwnProperty(scope)) {
    middlewares[scope] = [];
  }

  middlewares[scope].push(replacement);
}

function getMiddlewareMutation (scope) {
  let middlewareMutation = {};

  if (!middlewares.hasOwnProperty(scope)) {
    return middlewareMutation
  }

  middlewares[scope].forEach(mutation => {
    if (typeof mutation === 'function') {
      middlewareMutation = merge(middlewareMutation, mutation());
      return
    }
    middlewareMutation = merge(middlewareMutation, mutation);
  });

  console.log({ middlewareMutation });

  return middlewareMutation
}

/**
 * @function Utils.getConfig
 * @summary Returns the local project configuration alternatively merging with `merge`
 *
 * @desc In order to keep things simple, pleasure's entire configuration for a project is handled in only one only file
 * called `pleasure.config.js` and must be located in the root of the project's directory.
 *
 * This file must export an `Object` with scoped properties to configure pleasure's logic.
 *
 * @param {String} [scope=null] - The scope to return from the `pleasure.config.js` file. `null` to return the entire
 * config object.
 * @param {Object} [mergeWith] - Alternatively another configuration object to merge with the local found, overriding
 * local values.
 * @param {Boolean} [force=false] - Force read the configuration from file (avoiding cache).
 * @param {Boolean} [runMiddleware=true] - Force read the configuration from file (avoiding cache).
 *
 * @return {Config}
 *
 * @example <caption>Configuring pleasure</caption>
 *
 * ```js
 * module.exports = {
 *   // legacy: const { utils: { getConfig } } = require('pleasure')
 *   const { getConfig } = require('pleasure')
 * }
 * ```
 */
function getConfig (scope = null, mergeWith = {}, force = false, runMiddleware = true) {
  const configFile = findConfig();

  if (force) {
    delete require.cache[require.resolve(configFile)];
  }

  const loadedConfig = require(configFile);

  // node.js only
  return merge.all(
    [
      {}, scope ? get(loadedConfig, scope, {}) : loadedConfig,
      runMiddleware ? getMiddlewareMutation(scope) : {},
      mergeWith || {}
    ]
  )
}

export { eventsBus as EventBus, deepScanDir, extendConfig, findConfig, findPackageJson, findRoot, getConfig, packageJson, randomUniqueId, readdirAsync };
