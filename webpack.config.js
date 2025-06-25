const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development', // or 'production' for optimized builds
  entry: './src/index.tsx', // Your React app's entry point
  output: {
    path: path.resolve(__dirname, 'dist'), // Output bundle to 'dist' folder
    filename: 'bundle.js', // Name of the bundled JavaScript file
    publicPath: '/' // Base path for all assets
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'], // Resolve these extensions
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/, // Regex to match .ts and .tsx files
        exclude: /node_modules/,
        use: 'ts-loader', // Use ts-loader for TypeScript files
      },
      {
        test: /\.css$/, // Regex to match .css files
        use: [
          'style-loader', // Injects CSS into the DOM
          'css-loader',   // Interprets @import and url()
          {
            loader: 'postcss-loader', // Processes CSS with PostCSS (for Tailwind)
            options: {
              postcssOptions: {
                plugins: [
                  require('tailwindcss'),
                  require('autoprefixer'),
                ],
              },
            },
          },
        ],
      },
      // You might add rules for images, fonts, etc. if your app uses them
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html', // Use your existing index.html as a template
      filename: 'index.html', // Output HTML file name
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'), // Serve static files from 'dist'
    },
    compress: true,
    port: 3000, // Port for the development server
    open: true, // Open browser automatically
    historyApiFallback: true, // Fallback to index.html for React Router (if used)
  },
};
