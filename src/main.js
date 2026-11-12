import {
  Color, Mesh, MeshBasicNodeMaterial, NoToneMapping, OrthographicCamera,
  Scene, SphereGeometry, SRGBColorSpace, Vector3, WebGPURenderer,
} from 'three/webgpu';
import { clamp, color, dot, normalWorld, normalize, pow, uniform, vec4 } from 'three/tsl';
import { neuralIntensity } from './neural-mlp.js';
import './style.css';

const canvas = document.querySelector('#scene');
const slider = document.querySelector('#azimuth');
const angle = document.querySelector('#angle');
const status = document.querySelector('#status');
let failed = false;

function showError(error) {
  failed = true;
  canvas.hidden = true;
  slider.disabled = true;
  status.dataset.state = 'error';
  status.textContent = `Unable to run the WebGPU demo: ${error.message} `
    + 'Use a current WebGPU-capable browser with graphics acceleration enabled, '
    + 'on localhost or HTTPS, then reload. Check the browser GPU diagnostics if the problem persists.';
  console.error(error);
}

async function start() {
  if (!window.isSecureContext || !navigator.gpu) {
    throw new Error('WebGPU is unavailable in this browser or context.');
  }

  const renderer = new WebGPURenderer({ canvas, antialias: true });
  renderer.onDeviceLost = (info) => showError(new Error(`GPU device lost: ${info.message}`));
  await renderer.init();
  // WebGPURenderer can initialize WebGL2 automatically. Never render that fallback.
  if (!renderer.backend.isWebGPUBackend) {
    renderer.dispose();
    throw new Error('A WebGPU adapter/device could not be initialized (WebGL2 fallback rejected).');
  }
  const device = renderer.backend.device;
  device.addEventListener('uncapturederror', (event) => showError(event.error));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new Scene();
  scene.background = new Color('#18212c');
  // Orthographic projection keeps both spheres exactly the same apparent size.
  const camera = new OrthographicCamera(-2.8, 2.8, 1.4, -1.4, 0.1, 20);
  camera.position.set(0, 0, 6);
  const geometry = new SphereGeometry(1, 96, 64);
  const lightDirection = uniform(new Vector3());
  const baseColor = color(new Color('#8fcbff'));
  const x = clamp(dot(normalize(normalWorld), normalize(lightDirection)), 0, 1);

  for (const [index, intensity] of [pow(x, 4), neuralIntensity(x)].entries()) {
    const material = new MeshBasicNodeMaterial();
    // fragmentNode bypasses built-in lighting. Both outputs share the same clamp,
    // linear base color, no tone mapping, and linear-to-sRGB output conversion.
    material.fragmentNode = vec4(baseColor.mul(clamp(intensity, 0, 1)), 1);
    const sphere = new Mesh(geometry, material);
    sphere.position.x = index === 0 ? -1.4 : 1.4;
    scene.add(sphere);
  }

  function updateLight() {
    const radians = Number(slider.value) * Math.PI / 180;
    lightDirection.value.set(Math.sin(radians), 0.35, Math.cos(radians)).normalize();
    angle.value = `${slider.value}°`;
  }

  function render() {
    if (failed) return;
    try {
      renderer.render(scene, camera);
    } catch (error) {
      showError(error);
    }
  }

  function resize() {
    if (failed) return;
    const { width, height } = canvas.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.top = 2.8 * height / width;
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    render();
  }

  updateLight();
  canvas.hidden = false;
  // Include shader/pipeline validation in initialization before reporting success.
  device.pushErrorScope('validation');
  await renderer.compileAsync(scene, camera);
  resize();
  await device.queue.onSubmittedWorkDone();
  const validationError = await device.popErrorScope();
  if (validationError) throw validationError;
  if (failed) return;

  slider.addEventListener('input', () => {
    updateLight();
    render();
  });
  new ResizeObserver(resize).observe(canvas);
  slider.disabled = false;
  status.dataset.state = 'ready';
  status.textContent = 'WebGPU active · both fragment shaders compiled.';
}

start().catch(showError);
