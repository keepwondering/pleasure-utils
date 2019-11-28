import path from 'path'
import commonjs from 'rollup-plugin-commonjs'
import json from 'rollup-plugin-json'
import alias from 'rollup-plugin-alias'
// import minify from 'rollup-plugin-babel-minify'
import { name, version, author } from './package.json'

const fromSrc = (...paths) => {
  return path.join(__dirname, 'src', ...paths)
}

const plugins = [
  alias({
    entries: [
      {
        find: 'src',
        replacement: fromSrc(),
      },
      {
        find: 'lib',
        replacement: fromSrc('lib')

      }
    ]
  }),
  json(),
  commonjs({
    // non-CommonJS modules will be ignored, but you can also
    // specifically include/exclude files

    // if true then uses of `global` won't be dealt with by this plugin
    ignoreGlobal: true, // Default: false

    // if false then skip sourceMap generation for CommonJS modules
    sourceMap: true // Default: true
  })
]

const banner = `/*!
 * ${ name } v${ version }
 * (c) 2018-${ new Date().getFullYear() } ${ author }
 * Released under the MIT License.
 */`

export default [
  {
    input: 'src/pleasure-utils.js',
    output: [
      {
        file: 'dist/pleasure-utils.js',
        format: 'cjs',
        banner
      },
      {
        file: 'dist/pleasure-utils.esm.js',
        format: 'esm',
        banner
      }
    ],
    plugins
  }
]
