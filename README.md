# Babylon.js on Mapbox GL

A Babylon.js scene rendered **into Mapbox GL JS's own WebGL 2 context**, as a
Mapbox [custom layer](https://docs.mapbox.com/mapbox-gl-js/api/properties/#customlayerinterface).
Both engines share one context and one canvas; Babylon's camera is driven from
the matrix Mapbox hands to the layer each frame, so the Babylon meshes are
georeferenced — they sit at a real lng/lat and stay put as you pan, zoom and
pitch the map.

![Babylon ground plane and box rendered inside the Mapbox custom layer](docs/screenshots/babylon-layer.png)

The teal 50 m ground plane and the 5 m box above it are the Babylon scene,
placed at 103.6958 E, 1.3542 N (western Singapore) and drawn in Mapbox's pitched
camera. The screenshot uses a plain background style rather than street tiles,
because rendering the real style needs your own Mapbox token — see
[Mapbox token](#mapbox-token).

## How it works

All of it is in [`src/index.ts`](src/index.ts):

1. Mapbox creates the map, the canvas and the GL context — Babylon does not own
   any of them.
2. A custom layer's `onAdd(map, gl)` receives Mapbox's `WebGL2RenderingContext`
   and builds `new Engine(gl, true, { useHighPrecisionMatrix: true }, true)` on
   it. High-precision matrices matter here: at mercator scale, float32 matrices
   visibly jitter.
3. The Babylon scene is configured not to fight its host — `autoClear = false`,
   `autoClearDepthAndStencil = false`, `detachControl()`, and a bare
   `BABYLON.Camera` whose projection is supplied from outside.
4. Each frame, the layer's `render(gl, matrix)` composes a world matrix from the
   mercator coordinate of the model origin and `meterInMercatorCoordinateUnits()`
   as the scale, multiplies it by Mapbox's view-projection matrix, and hands the
   result to `freezeProjectionMatrix()`. The camera position is recovered by
   inverting that matrix.
5. `engine.wipeCaches()` resyncs Babylon's cached GL state, since Mapbox has
   been drawing through the same context — `false` before the render, `true` in
   `beforeRender`.
6. `map.triggerRepaint()` keeps the loop going so the box animates.

The layer is inserted with `map.addLayer(customLayer, 'waterway-label')`, which
places the 3D content underneath the style's labels. That before-id only exists
in Mapbox's own street styles; with a custom style, use a layer id from it or
drop the argument.

## Mapbox token

**You need your own token.** Get one from
[account.mapbox.com/access-tokens](https://account.mapbox.com/access-tokens/)
and pass it in at build time:

```bash
MAPBOX_TOKEN=pk.your_token npm start        # dev server
MAPBOX_TOKEN=pk.your_token npm run build    # production build into dist/
```

Webpack injects it via `DefinePlugin`, so nothing needs to be written to disk
and no token is committed. Built without one, the page says so instead of going
blank:

![The no-token message](docs/screenshots/no-token.png)

A token previously lived hardcoded in `src/index.ts`. It was not this project's
token, it now returns HTTP 401, and it is still in this repository's git history
— see [Repository history](#repository-history).

## Running it

```bash
npm install
MAPBOX_TOKEN=pk.your_token npm start
```

`npm run build` writes `dist/` (bundle plus a generated `index.html`), which is
plain static output — any file server will do.

Requires Node 20+.

## State of the inherited boilerplate

This started from [RaananW/babylonjs-webpack-es6](https://github.com/RaananW/babylonjs-webpack-es6),
and two pieces of that scaffolding no longer apply:

- **`npm test` does not run.** `tests/validation.spec.ts` drives scenes from the
  original boilerplate (`?scene=fresnelShader`, `?scene=loadModelAndEnv`, …)
  that this project does not implement, and its reference snapshots are
  `-win32.png`, so they cannot match on macOS or Linux anyway.
- **`npm run lint` does not run.** There is no ESLint configuration in the
  repository, so ESLint exits asking to be initialised.

Neither is wired into CI. They are worth either fixing or deleting.

## Repository history

The Mapbox token that used to be in `src/index.ts` belongs to the Mapbox
account `motional`, not to this project. It is removed from the working tree,
but **a `git log -p` still shows it**, and this is a public repository. It
returns 401, so it grants nothing today — but if you want it gone for good, the
history is only two commits and a rewrite is cheap:

```bash
git filter-repo --replace-text <(echo 'pk.eyJ1IjoibW90aW9uYWwi***==>REMOVED')
git push --force
```

That rewrites published commits, so coordinate it with anyone holding a clone.

## Continuous integration

[`.github/workflows/build.yml`](.github/workflows/build.yml) type-checks and
builds the bundle on every push and pull request. It builds **without** a token
— that verifies compilation, not map rendering, which is the most CI can do
without a credential.

There is deliberately no deployment: a hosted build would need a real Mapbox
token baked into a public bundle.

## Layout

```text
src/index.ts               the whole experiment: Babylon scene + Mapbox custom layer
src/externalFileTypes.d.ts asset module declarations and the MAPBOX_TOKEN global
public/index.html          page shell; loads the Mapbox GL stylesheet
webpack.common.js          shared config; injects MAPBOX_TOKEN
webpack.{dev,prod,tests}.js
tests/                     inherited Playwright specs — see above
docs/screenshots/          images used in this README
```

## Credits

Built on [Raanan Weber](http://blog.raananweber.com/)'s
[babylonjs-webpack-es6](https://github.com/RaananW/babylonjs-webpack-es6)
starter (Apache-2.0), with the Mapbox custom-layer integration layered on top.
