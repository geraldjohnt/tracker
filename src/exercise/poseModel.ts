// Loads MediaPipe Pose Landmarker on first use (when a camera check opens), so the
// Exercise page stays light. The JS and Wasm are bundled with the site; the model file
// (~5.8 MB) is fetched from Google's model storage once and then cached by the browser.
// Video frames are processed on the device and never stored or sent anywhere.
import type { PoseLandmarker } from '@mediapipe/tasks-vision';

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

let loading: Promise<PoseLandmarker> | null = null;

export function loadPoseModel(): Promise<PoseLandmarker> {
  loading ??= (async () => {
    const [{ PoseLandmarker }, loader, binary] = await Promise.all([
      import('@mediapipe/tasks-vision'),
      import('@mediapipe/tasks-vision/vision_wasm_internal.js?url'),
      import('@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'),
    ]);
    const fileset = { wasmLoaderPath: loader.default, wasmBinaryPath: binary.default };
    const options = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO' as const,
      numPoses: 1,
    });
    try {
      return await PoseLandmarker.createFromOptions(fileset, options('GPU'));
    } catch {
      return await PoseLandmarker.createFromOptions(fileset, options('CPU')); // no WebGL2 (older phones)
    }
  })();
  loading.catch(() => { loading = null; }); // let a later attempt retry (e.g. it was offline)
  return loading;
}
