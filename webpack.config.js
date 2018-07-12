const webpack = require('webpack');
const path = require('path');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: path.join(__dirname, 'frontend', 'main.js'),
    output: {
        path: path.join(__dirname, 'public'),
        filename: 'script.js'
    },
    module: {
        rules: [
        {
            test: /\.js$/,
            exclude: /(node_modules|bower_components)/,
            loader: 'babel-loader',
            query: {
            presets: ['es2015']
            }
        },
        {
            test: /\.vue$/,
            loader: 'vue-loader'
        }
        ]
    },
    resolve: {
        alias: {
            'vue$': 'vue/dist/vue.esm.js'
        }
    },
    plugins: [
        new UglifyJsPlugin(),
        new HtmlWebpackPlugin({
            template: path.join(__dirname, 'frontend', 'index.html')
        }),
        new CopyWebpackPlugin([ { from: path.join(__dirname, 'frontend', 'style.css'), to: path.join(__dirname, 'public', 'style.css') } ])
    ]
};