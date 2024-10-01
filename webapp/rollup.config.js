import nodeResolve from "@rollup/plugin-node-resolve";
//import typescript from "@rollup/plugin-typescript";
import commonjs from "@rollup/plugin-commonjs";
import copy from "rollup-plugin-copy";
//import replace from "@rollup/plugin-replace";
//import builtins from "rollup-plugin-node-builtins";
//import globals from "rollup-plugin-node-globals";

import builtins from "rollup-plugin-node-builtins";
//import workerLoader from 'rollup-plugin-web-worker-loader';

import babel from "@rollup/plugin-babel";
import html from "@web/rollup-plugin-html";
//import { importMetaAssets } from "@web/rollup-plugin-import-meta-assets";
//import { terser } from "rollup-plugin-terser";
//import { generateSW } from "rollup-plugin-workbox";
//import path from "path";
//const pkg = require("./package.json");

const DIST_FOLDER = "dist"

export default {
  input: "index.html",
  output: {
    entryFileNames: "index.js",
    //chunkFileNames: "[hash].js",
    assetFileNames: "assets[extname]",
    format: "es",
    dir: DIST_FOLDER,
  },
  external: [],
  watch: {
    clearScreen: false,
  },
  plugins: [
    /** Enable using HTML as rollup entrypoint */
    html({
      //minify: true,
      //injectServiceWorker: true,
      //serviceWorkerPath: "dist/sw.js",
    }),
    /** Resolve bare module imports */
    nodeResolve({
      browser: true,
      preferBuiltins: false,
    }),
    //typescript({ experimentalDecorators: true, outDir: DIST_FOLDER }),
    builtins(),
    //globals(),
    /** Minify JS */
    //terser(),
    /** Bundle assets references via import.meta.url */
   // importMetaAssets(),
    /** Compile JS to a lower language target */
    babel({
      exclude: /node_modules/,

      babelHelpers: "bundled",
      presets: [
        [
          require.resolve("@babel/preset-env"),
          {
            targets: [
              "last 3 Chrome major versions",
              "last 3 Firefox major versions",
              "last 3 Edge major versions",
              "last 3 Safari major versions",
            ],
            modules: false,
            bugfixes: true,
          },
        ],
      ],
      plugins: [
        [
          require.resolve("babel-plugin-template-html-minifier"),
          {
            modules: {
              lit: ["html", { name: "css", encapsulation: "style" }],
            },
            failOnError: false,
            strictCSS: true,
            htmlMinifier: {
              collapseWhitespace: true,
              conservativeCollapse: true,
              removeComments: true,
              caseSensitive: true,
              minifyCSS: true,
            },
          },
        ],
      ],
    }),
    commonjs(),
    //workerLoader(),
    copy({
      //copyOnce: true,
      targets: [
        { src: "../assets/icon.png", dest: DIST_FOLDER },
        { src: "../assets/favicon.png", dest: DIST_FOLDER },
        { src: "../assets/favicon.ico", dest: DIST_FOLDER },
        //{ src: "index.html", dest: DIST_FOLDER },
        {
          src: '../node_modules/@shoelace-style/shoelace/dist/assets',
          dest: 'dist/shoelace',
        },
        //{ src: "../node_modules/@shoelace-style/shoelace/dist/themes/light.css", dest: DIST_FOLDER, rename: "styles.css" }
      ],
    }),
  ],
};
