// SPDX-License-Identifier: MIT OR LGPL-2.1-or-later
// SPDX-FileCopyrightText: 2026 The Sushi authors

import {defineConfig, globalIgnores} from 'eslint/config';
import gnome from 'eslint-config-gnome';

export default defineConfig([
    globalIgnores(['src/util/totemMimeTypes.js']),
    gnome.configs.recommended,
    {
        rules: {
            'no-shadow': 'off',
            'eqeqeq': ['error', 'always', {'null': 'ignore'}],
            'no-var': 'error',
            'no-restricted-globals': [
                'error',
                {
                    name: 'log',
                    message: 'Use console.log()',
                },
                {
                    name: 'logError',
                    message: 'Use console.warn() or console.error()',
                },
            ],
            'no-restricted-properties': [
                'error',
                {
                    object: 'imports',
                    property: 'format',
                    message: 'Use template strings',
                },
                {
                    object: 'pkg',
                    property: 'initFormat',
                    message: 'Use template strings',
                },
                {
                    object: 'Lang',
                    property: 'copyProperties',
                    message: 'Use Object.assign()',
                },
                {
                    object: 'Lang',
                    property: 'bind',
                    message: 'Use arrow notation or Function.prototype.bind()',
                },
                {
                    object: 'Lang',
                    property: 'Class',
                    message: 'Use ES6 classes',
                },
            ],
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        'MethodDefinition[key.name="_init"]' +
                        'FunctionExpression[params.length=1]' +
                        'BlockStatement[body.length=1]' +
                        'CallExpression[arguments.length=1][callee.object.type="Super"][callee.property.name="_init"]' +
                        'Identifier:first-child',
                    message: '_init() that only calls super._init() is unnecessary',
                },
                {
                    selector:
                        'MethodDefinition[key.name="_init"]' +
                        'FunctionExpression[params.length=0]' +
                        'BlockStatement[body.length=1]' +
                        'CallExpression[arguments.length=0][callee.object.type="Super"][callee.property.name="_init"]',
                    message: '_init() that only calls super._init() is unnecessary',
                },
                {
                    selector: 'BinaryExpression[operator="instanceof"][right.name="Array"]',
                    message: 'Use Array.isArray()',
                },
                {
                    selector: 'MethodDefinition[key.name="_init"] CallExpression[arguments.length<=1][callee.object.type="Super"][callee.property.name="_init"]',
                    message: 'Use constructor() and super()',
                },
            ],
        },
        languageOptions: {
            globals: {
                pkg: 'readonly',
                _: 'readonly',
                C_: 'readonly',
                N_: 'readonly',
                ngettext: 'readonly',
            },
        },
    },
]);
