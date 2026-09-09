import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { CreateBox, CreateSphere } from "@babylonjs/core";
import mapboxgl, { Map } from 'mapbox-gl'
import * as BABYLON from '@babylonjs/core';

/*************************************************/
/***************** BABYLON SCENE *****************/
/*************************************************/

let engine: Engine;
let scene: Scene; 

let customLayer: any;
const groundElevation = 0.1;

function createEngine(glContext: WebGL2RenderingContext) {
  return new Engine(
    glContext,
    true,
    {
    useHighPrecisionMatrix: true // Important to prevent jitter at mercator scale
    },
    true
    );
}

function createSceneSimple(engine: Engine) {
	scene = new BABYLON.Scene(engine);
  scene.activeCamera = new BABYLON.Camera("mapbox-Camera", new BABYLON.Vector3(), scene);
  scene.autoClear = false;
  scene.autoClearDepthAndStencil = false;
  scene.detachControl();
  
 	const light = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(1, 1, 0), scene)

  const ground = BABYLON.Mesh.CreateGround('', 50, 50, 3, scene)
  ground.position.y = groundElevation;
  const groundmaterial = new BABYLON.StandardMaterial('', scene)
  ground.material = groundmaterial;
  groundmaterial.diffuseColor = BABYLON.Color3.FromInts(10, 100, 120)

  const box = BABYLON.MeshBuilder.CreateBox("box", {size:5}, scene);
  // box.scaling.z = 0.510000123; // HACK TO MAKE THE GROUND VISIBLE
  // box.position.copyFromFloats(-20, groundElevation, 0)
  // box.position.y = 1;

  let a = 0;
  const axis = new BABYLON.Vector3(0, 1, 0);
  scene.registerBeforeRender(function () {
    box.rotate(axis, a = 0.01);
  });

  return scene;	
}

function getWorldMatrix(mercatorCoordinate: [number, number, number], scaleFactor: number) {
  const rotationMatrix = BABYLON.Matrix.RotationX(Math.PI / 2);
  // @ts-ignore
  const translateMatrix = BABYLON.Matrix.Identity().setTranslationFromFloats(mercatorCoordinate[0], mercatorCoordinate[1], mercatorCoordinate[2]);
  const scaleMatrix = BABYLON.Matrix.Scaling(scaleFactor, scaleFactor, scaleFactor);
  const worldMatrix = scaleMatrix.multiply(rotationMatrix.multiply(translateMatrix));

  return worldMatrix;
}

function renderFromMatrix(matrix:any, mercatorCoordinate: [number, number, number], scaleFactor: number) {
    const engine = scene.getEngine();

    if (scene) {
      const projection = BABYLON.Matrix.FromArray(matrix);
      engine.wipeCaches(false);
      scene.beforeRender = () => {
        engine.wipeCaches(true);
      };
      if (!scene.activeCamera) {
        console.log('scene.activeCamera is null')
        return;
      }
      
      scene.activeCamera.freezeProjectionMatrix(getWorldMatrix(mercatorCoordinate, scaleFactor).multiply(projection));
      let invert = scene.activeCamera.getProjectionMatrix().clone().invert();
      scene.activeCamera.position = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(), invert)
      scene.render(false);
    }
  }

/*************************************************/
/******************* MAP BOX *********************/
/*************************************************/
export const mapBoxInit = async (accessToken: string, id: string | HTMLElement, style: string, center: [number, number], zoom: number): Promise<Map> => {
    mapboxgl.accessToken = accessToken;
    const map = new mapboxgl.Map({
        container: id,
        style: style,
        zoom: zoom,
        center: center,
        pitch: 60,
        antialias: true,
      });

      
  customLayer = {
    id: '3d-model',
    type: 'custom',
    renderingMode: '3d',
    onAdd: function(map:  mapboxgl.Map, gl: WebGL2RenderingContext) {
       engine = createEngine(gl);
       scene = createSceneSimple(this.engine);
    },
    render(gl: WebGL2RenderingContext, matrix: any) {
      if (scene) {
        const modelOrigin = {lng: center[0], lat: center[1]}; // https://docs.mapbox.com/mapbox-gl-js/api/geography/#mercatorcoordinate.fromlnglat
        const modelAltitude = 0;
      
        const mercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(modelOrigin, modelAltitude);
        const scaleFactor = mercatorCoordinate.meterInMercatorCoordinateUnits();
  
        renderFromMatrix(matrix, [mercatorCoordinate.x, mercatorCoordinate.y, mercatorCoordinate.z ? mercatorCoordinate.z: 0], scaleFactor)
      }

      map.triggerRepaint();
    }
  }

  return new Promise(resolve => {
    map.on('style.load', () => { 
        map.addLayer(customLayer, 'waterway-label'); 
        resolve(map); 
    });
  });
};

// Supplied at build time from the MAPBOX_TOKEN environment variable.
// Never commit a token: see the README.
const accessToken = process.env.MAPBOX_TOKEN || '';
const style = 'mapbox://styles/mapbox/streets-v11';

const mapDiv = document.createElement('div');
mapDiv.setAttribute('id', 'map')
mapDiv.style.width = document.body.clientWidth.toString() + 'px';
mapDiv.style.height = document.body.clientHeight.toString() + 'px';
document.body.appendChild(mapDiv);

if (!accessToken) {
  // Without a token Mapbox never fires 'style.load', so the custom layer is
  // never added and Babylon never initializes. Say so instead of going blank.
  mapDiv.style.font = '14px/1.6 system-ui, sans-serif';
  mapDiv.style.padding = '24px';
  mapDiv.innerHTML =
    '<strong>No Mapbox access token.</strong><br>' +
    'Build with <code>MAPBOX_TOKEN=pk.your_token npm run build</code> ' +
    '(or <code>npm start</code>) using a token from ' +
    '<a href="https://account.mapbox.com/access-tokens/">account.mapbox.com</a>.';
  console.error('MAPBOX_TOKEN is not set; the map cannot load. See README.');
} else {
  mapBoxInit(accessToken, 'map', style, [103.6958, 1.3542], 17.5).then(() => {
    // scene started rendering, everything is initialized
  });
}



