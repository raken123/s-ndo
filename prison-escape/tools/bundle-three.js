#!/usr/bin/env node
/* Bundles three.js into a plain classic script that defines window.THREE.

   Cordova serves the app from file://, where ES modules are blocked, so the
   published ESM build cannot be loaded directly. esbuild turns it into a
   minified IIFE that a normal <script> tag can load, tree-shaken down to the
   parts the game actually imports.

   usage: npm i && node tools/bundle-three.js  ->  www/js/lib/three.bundle.js
*/
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const entry = path.join(ROOT, 'tools/.three-entry.js');

fs.writeFileSync(entry, `
import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Object3D, Color, Fog, FogExp2,
  Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial, Sprite, SpriteMaterial,
  BufferGeometry, BufferAttribute, Float32BufferAttribute, BoxGeometry, PlaneGeometry,
  SphereGeometry, CylinderGeometry, ConeGeometry, CircleGeometry,
  AmbientLight, HemisphereLight, DirectionalLight, PointLight, SpotLight,
  CanvasTexture, RepeatWrapping, NearestFilter, LinearFilter, SRGBColorSpace,
  DoubleSide, BackSide, FrontSide, AdditiveBlending, NormalBlending,
  Vector2, Vector3, Euler, MathUtils, Raycaster, Clock
} from 'three';

window.THREE = {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Object3D, Color, Fog, FogExp2,
  Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial, Sprite, SpriteMaterial,
  BufferGeometry, BufferAttribute, Float32BufferAttribute, BoxGeometry, PlaneGeometry,
  SphereGeometry, CylinderGeometry, ConeGeometry, CircleGeometry,
  AmbientLight, HemisphereLight, DirectionalLight, PointLight, SpotLight,
  CanvasTexture, RepeatWrapping, NearestFilter, LinearFilter, SRGBColorSpace,
  DoubleSide, BackSide, FrontSide, AdditiveBlending, NormalBlending,
  Vector2, Vector3, Euler, MathUtils, Raycaster, Clock
};
`);

esbuild.buildSync({
  entryPoints: [entry],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2019'],
  legalComments: 'none',
  outfile: path.join(ROOT, 'www/js/lib/three.bundle.js')
});

fs.unlinkSync(entry);
const kb = fs.statSync(path.join(ROOT, 'www/js/lib/three.bundle.js')).size / 1024;
console.log('www/js/lib/three.bundle.js', kb.toFixed(0) + ' kB');
