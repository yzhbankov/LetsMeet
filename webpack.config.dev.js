const webpack = require('webpack');
const WriteFilePlugin = require('write-file-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const OptimizeCSS = require('optimize-css-assets-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const path = require('path');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

let noVisualization = false;

if (!process.env.ANALYSE_PACK){
    noVisualization = true;
}

const VENDOR_LIBS = [
  'autobind-decorator',
  'bluebird',
  'colorsys',
  'es6-promise',
  'fast-json-patch',
  'isomorphic-fetch',
  'lodash',
  'materialize-css',
  'moment',
  'react',
  'react-addons-update',
  'react-day-picker',
  'react-dom',
  'react-css-modules',
  'react-masonry-component',
  'react-notification',
  'react-router',
  'immutable',
  'material-ui',
  'nprogress',
  'clipboard',
];

module.exports = {
  context: __dirname,
  entry: {
    bundle: [
      'react-hot-loader/patch',
      'webpack-hot-middleware/client?reload=true',
      './client/main.js',
    ],
    vendor: VENDOR_LIBS,
  },
  output: {
    path: path.resolve('./build/client'),
    publicPath: '/client/',
    filename: '[name].[hash].js',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.(ttf|eot|woff(2)?)(\?[a-z0-9]+)?$/,
        loader: 'file-loader',
      },
      {
        test: /\.(png|jp?g|gif|svg)$/,
        use: [
          {
            loader: 'url-loader',
            options: { limit: 40000 },
          },
          'image-webpack-loader',
        ],
      },
      {
        test: /\.css$/,
        exclude: [/node_modules/, /no-css-modules/],
        loaders: [
          'style-loader?sourceMap',
          'css-loader?modules&importLoaders=1&localIdentName=[path]___[name]__[local]___[hash:base64:5]',
        ],
      },
      {
        test: /\.css$/,
        include: [/node_modules/, /no-css-modules/],
        loader: ExtractTextPlugin.extract({
          fallbackLoader: 'style-loader?sourceMap',
          loader: 'css-loader',
        }),
      },
    ],
  },
  plugins: [
     (!noVisualization ?
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
        }) : null),

    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    }),
    new ExtractTextPlugin('vendor.css'),
    new OptimizeCSS({
      cssProcessorOptions: { discardComments: { removeAll: true } },
    }),
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.optimize.CommonsChunkPlugin({
      names: ['vendor', 'manifest'],
    }),
    new WriteFilePlugin({
      test: /\.(html|ejs)$/,
    }),
    new HtmlWebpackPlugin({
      title: 'Lets Meet',
      template: 'html-loader!./client/index.html',
      filename: '../index.html',
      inject: 'body',
    }),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NamedModulesPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
  ].filter(p => p),
  resolve: {
    extensions: ['.js', '.css'],
  },
  devtool: 'source-map',
};
