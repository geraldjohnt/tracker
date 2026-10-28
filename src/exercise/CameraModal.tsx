import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { useBsModal } from '../shared/components/useBsModal';
import type { Exercise, TrackerKind } from './catalog';
import { manualXp } from './derive';
import { MovementFigure } from './MovementFigure';
import { fmtAmount } from './parts';
import { cameraGoal, cameraProgress, createCounter, LM, type Counter, type CounterState, type Landmark } from './pose';
import { loadPoseModel } from './poseModel';

export interface CameraQuest {
  ex: Exercise;
  /** Reps or seconds the quest asks for (per side for per-side exercises). */
  amount: number;
  /** Full XP (with the camera). */
  xp: number;
  /** Called once: `camera` is true when the camera counted it, false for a half-XP manual completion. */
  onComplete: (camera: boolean) => void;
}
export interface CameraModalHandle { open(q: CameraQuest): void }

type Status = 'starting' | 'running' | 'complete' | 'denied' | 'nocamera' | 'error';

const SIDE_ON = 'side-on to the camera';
const SETUP: Record<TrackerKind | 'watch', string> = {
  squat: `Stand ${SIDE_ON}, about 2–3 m away, with your whole body in the picture. Facing the camera works too, and checks that your knees don’t cave in.`,
  jumpsquat: `Stand ${SIDE_ON} (or facing it), 2–3 m away, with your whole body and some floor in the picture. Each rep needs a real jump.`,
  lunge: `Stand ${SIDE_ON} with your whole body in the picture. Lunges on both legs count.`,
  sidelunge: 'Face the camera, 2–3 m away, with your whole body in the picture. Lunges to both sides count.',
  calfraise: `Stand ${SIDE_ON} with your legs and feet clearly in the picture (the phone low, on the floor, works best).`,
  pushup: `Put the phone on the floor, ${SIDE_ON}, so your head, hips and knees are all in the picture.`,
  wallpush: `Stand ${SIDE_ON} at the wall, with your head, hips and knees in the picture.`,
  pike: `Put the phone on the floor, ${SIDE_ON}, with your hands, hips and feet in the picture.`,
  archer: 'Put the phone on the floor in front of you, facing you, so both arms are in the picture. Reps to both sides count.',
  hspu: `Set the phone ${SIDE_ON} and the wall, far enough back that your hands, head and hips are in the picture.`,
  dip: `Set the phone ${SIDE_ON}, with your hands, elbows, shoulders and hips in the picture.`,
  pullup: 'Set the phone back from the bar (front or side), so your hands, head and elbows are all in the picture.',
  row: `Set the phone ${SIDE_ON}, low down, so your hands, shoulders, hips and feet are in the picture.`,
  bridge: `Lie on your back ${SIDE_ON}, with your shoulders, hips and knees in the picture.`,
  superman: `Lie face down ${SIDE_ON}, arms reaching forward, with your hands and feet in the picture.`,
  snowangel: `Lie face down ${SIDE_ON}, with your arms, shoulders and hips in the picture.`,
  crunch: `Lie on your back ${SIDE_ON}, knees bent, with your shoulders, hips and knees in the picture.`,
  bicycle: `Lie on your back ${SIDE_ON}, with your shoulders, hips and knees in the picture. Both legs count.`,
  deadbug: `Lie on your back ${SIDE_ON}, with your whole body in the picture. Each leg counts as it straightens.`,
  birddog: `Get on your hands and knees ${SIDE_ON}, with your whole body in the picture. Both sides count.`,
  legraise: `Set up ${SIDE_ON}, with your shoulders, hips and feet in the picture. Keep your legs straight.`,
  kneeraise: `Hang from the bar ${SIDE_ON}, with your hands, hips and knees in the picture.`,
  vup: `Lie on your back ${SIDE_ON}, arms overhead, with your hands and feet in the picture.`,
  climber: `Get into a high plank ${SIDE_ON}, with your whole body in the picture. Both legs count.`,
  jack: 'Face the camera, 2–3 m away, with your whole body in the picture, arms included.',
  burpee: `Stand ${SIDE_ON}, 2–3 m away, so your whole body fits both standing and in the plank.`,
  tuckjump: `Stand ${SIDE_ON}, 2–3 m away, with your whole body and some floor in the picture.`,
  nordic: `Kneel ${SIDE_ON}, with your shoulders, hips, knees and ankles in the picture.`,
  dragonflag: `Lie on the bench ${SIDE_ON}, far enough back that your whole body fits when your legs are up.`,
  plank: `Set up ${SIDE_ON} with your whole body, head to feet, in the picture. Seconds count while your body is straight.`,
  wallsit: `Sit against the wall ${SIDE_ON}, with hips, knees and ankles in the picture. Seconds count while you hold the position.`,
  hollow: `Lie on your back ${SIDE_ON}, with your whole body in the picture. Seconds count while shoulders and feet are off the floor.`,
  lsit: `Sit ${SIDE_ON}, with your arms, hips and feet in the picture. Seconds count while your legs are up and straight.`,
  watch: 'Keep your whole body in the picture while you do the exercise. This page can’t count this one yet (reload to update); the camera checks that you’re there for long enough.',
};

/** Lines of the stick figure drawn over the video. */
const BONES: Array<[number, number]> = [
  [LM.lShoulder, LM.rShoulder], [LM.lHip, LM.rHip], [LM.lShoulder, LM.lHip], [LM.rShoulder, LM.rHip],
  [LM.lShoulder, LM.lElbow], [LM.lElbow, LM.lWrist], [LM.rShoulder, LM.rElbow], [LM.rElbow, LM.rWrist],
  [LM.lHip, LM.lKnee], [LM.lKnee, LM.lAnkle], [LM.rHip, LM.rKnee], [LM.rKnee, LM.rAnkle],
  [LM.lAnkle, LM.lHeel], [LM.lHeel, LM.lFoot], [LM.lAnkle, LM.lFoot], [LM.rAnkle, LM.rHeel], [LM.rHeel, LM.rFoot], [LM.rAnkle, LM.rFoot],
];

const EMPTY: CounterState = { reps: 0, seconds: 0, inView: false, formOk: false, cue: '', depth: 0 };

const GOOD = '#22c55e', BAD = '#ef4444', NEUTRAL = 'rgba(255,255,255,.8)';

/**
 * Camera form check for a quest. Pose detection runs on the device; the video is shown
 * live and never recorded, stored or uploaded. If the camera can't be used, the quest can
 * still be completed for half XP.
 */
export function CameraModal({ ref }: { ref: Ref<CameraModalHandle> }) {
  const modal = useBsModal();
  const [quest, setQuest] = useState<CameraQuest | null>(null);
  const [status, setStatus] = useState<Status>('starting');
  const [loadingModel, setLoadingModel] = useState(true);
  const [live, setLive] = useState<CounterState>(EMPTY);
  const [counter, setCounter] = useState<Counter | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const session = useRef(0); // bumps on every open/close, so late async results are ignored
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef(0);
  const finished = useRef(false);

  const stop = useCallback(() => {
    session.current++;
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const finish = useCallback((camera: boolean) => {
    if (finished.current || !quest) return;
    finished.current = true;
    quest.onComplete(camera);
    stop();
    if (camera) { setStatus('complete'); setTimeout(() => modal.hide(), 1400); } else modal.hide();
  }, [quest, stop, modal]);

  const finishRef = useRef(finish);
  finishRef.current = finish;

  /** (Re)starts the check for a quest; a new quest object re-runs the camera effect below. */
  const begin = useCallback((q: CameraQuest) => {
    stop();
    finished.current = false;
    setQuest(q);
    setCounter(createCounter(q.ex));
    setLive(EMPTY);
    setStatus('starting');
    setLoadingModel(true);
  }, [stop]);

  useImperativeHandle(ref, () => ({ open(q) { begin(q); modal.show(); } }), [modal, begin]);

  // Stop the camera whenever the dialog closes, however it was closed.
  useEffect(() => {
    const el = modal.ref.current;
    if (!el) return;
    const onHidden = () => { stop(); setQuest(null); };
    el.addEventListener('hidden.bs.modal', onHidden);
    return () => { el.removeEventListener('hidden.bs.modal', onHidden); stop(); };
  }, [modal.ref, stop]);

  // Start the camera and the pose model for each quest that opens.
  useEffect(() => {
    if (!quest || !counter) return;
    const id = ++session.current;
    const alive = () => session.current === id;
    const goal = cameraGoal(quest.ex, quest.amount, counter.mode);

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setStatus('nocamera'); return; }
      const modelReady = loadPoseModel(); // download while the camera starts
      modelReady.catch(() => undefined);
      let s: MediaStream;
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      } catch (err) {
        if (!alive()) return;
        const name = (err as DOMException)?.name;
        setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nocamera' : 'error');
        return;
      }
      if (!alive()) { s.getTracks().forEach(t => t.stop()); return; }
      stream.current = s;
      s.getVideoTracks()[0]?.addEventListener('ended', () => { if (alive()) setStatus('error'); });
      const video = videoRef.current!;
      video.srcObject = s;
      await video.play().catch(() => undefined);
      if (!alive()) return;
      setStatus('running');

      let model;
      try { model = await modelReady; } catch (err) { console.error(err); if (alive()) setStatus('error'); return; }
      if (!alive()) return;
      setLoadingModel(false);

      let lastVideoTime = -1;
      let shown = '';
      const loop = () => {
        if (!alive()) return;
        raf.current = requestAnimationFrame(loop);
        if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
        lastVideoTime = video.currentTime;
        const now = performance.now();
        let lms: Landmark[] | undefined;
        try { lms = model.detectForVideo(video, now).landmarks[0]; } catch (err) { console.error(err); return; }
        const st = counter.update(lms, now / 1000, video.videoWidth / (video.videoHeight || 1));
        // Green only when the position is right; watch mode has no form checks, so it never claims that.
        draw(canvasRef.current, video, lms, !st.inView ? BAD : counter.mode === 'watch' ? NEUTRAL : st.formOk ? GOOD : BAD);
        const key = [st.reps, Math.floor(st.seconds), st.cue, st.inView, st.formOk, Math.round(st.depth * 10)].join('|');
        if (key !== shown) { shown = key; setLive(st); }
        if (cameraProgress(st, counter.mode) >= goal) finishRef.current(true);
      };
      loop();
    })();
  }, [quest, counter]);

  const goal = quest && counter ? cameraGoal(quest.ex, quest.amount, counter.mode) : 0;
  const progress = counter ? Math.min(goal, cameraProgress(live, counter.mode)) : 0;
  const unit = counter?.mode === 'reps' ? (goal === 1 ? 'rep' : 'reps') : 'sec';
  const blocked = status === 'denied' || status === 'nocamera' || status === 'error';
  const half = quest ? manualXp(quest.xp) : 0;

  return createPortal(
    <div className="modal fade" id="cameraModal" tabIndex={-1} ref={modal.ref} aria-labelledby="cameraModalTitle" data-bs-backdrop="static">
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          {quest && counter && <>
            <div className="modal-header">
              <div className="min-w-0">
                <h5 className="modal-title" id="cameraModalTitle"><i className="bi bi-camera-video me-2"></i>{quest.ex.name}</h5>
                <div className="ex-variant">{fmtAmount(quest.ex, quest.amount)} · +{quest.xp} XP with the camera</div>
              </div>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              {blocked ? (
                <div className="cam-blocked">
                  <div className="empty-icon"><i className={'bi ' + (status === 'denied' ? 'bi-camera-video-off' : 'bi-exclamation-triangle')}></i></div>
                  <h3>{status === 'denied' ? 'Camera access is blocked' : status === 'nocamera' ? 'No camera found' : 'The camera check couldn’t start'}</h3>
                  <p>
                    {status === 'denied'
                      ? 'Allow camera access for this site in your browser settings and try again, or complete the quest without the camera.'
                      : status === 'nocamera'
                        ? 'This device has no camera we can use. You can still complete the quest without it.'
                        : 'Check your connection (the pose model downloads the first time) and try again, or complete the quest without the camera.'}
                  </p>
                  <p className="cam-half">Without the camera you get half the XP: <b>+{half} XP</b> instead of +{quest.xp}.</p>
                  <div className="cam-actions">
                    {status !== 'nocamera' && <button type="button" className="btn btn-ghost" onClick={() => begin({ ...quest })}>Try again</button>}
                    <button type="button" className="btn-primary-x" onClick={() => finish(false)}>Complete for +{half} XP</button>
                  </div>
                </div>
              ) : status === 'complete' ? (
                <div className="cam-blocked">
                  <div className="empty-icon cam-done"><i className="bi bi-check-lg"></i></div>
                  <h3>Quest complete!</h3>
                  <p>+{quest.xp} XP · checked by the camera</p>
                </div>
              ) : (
                <>
                  <div className="cam-stage">
                    <video ref={videoRef} className="cam-video" playsInline muted aria-label="Camera preview"></video>
                    <canvas ref={canvasRef} className="cam-overlay" aria-hidden="true"></canvas>
                    {(status === 'starting' || loadingModel) && (
                      <div className="cam-loading">
                        <div className="spinner-border spinner-border-sm" role="status"></div>
                        <span>{status === 'starting' ? 'Starting the camera…' : 'Loading the pose model…'}</span>
                      </div>
                    )}
                    {status === 'running' && !loadingModel && (
                      <ViewPill state={live} watch={counter.mode === 'watch'} />
                    )}
                    {counter.mode === 'reps' && <div className="cam-depth" aria-hidden="true"><div style={{ height: live.depth * 100 + '%' }}></div></div>}
                  </div>
                  <div className="cam-count">
                    <div className="cam-count-num"><b>{progress}</b> / {goal} {unit}</div>
                    <div className="xp-bar"><div className="xp-fill" style={{ width: (goal ? (progress / goal) * 100 : 0) + '%' }}></div></div>
                    <div className={'cam-cue' + (live.cue ? ' show' : '')} role="status" aria-live="polite">{live.cue || ' '}</div>
                  </div>
                  <div className="cam-guide">
                    <MovementFigure key={quest.ex.id} exId={quest.ex.id} compact />
                    <p className="cam-setup"><i className="bi bi-info-circle"></i>{SETUP[counter.mode === 'watch' ? 'watch' : quest.ex.tracker!]}</p>
                  </div>
                  <p className="cam-privacy"><i className="bi bi-shield-lock"></i>The video stays on this device. Nothing is recorded or uploaded.</p>
                  <button type="button" className="link-btn cam-skip" onClick={() => finish(false)}>Can’t use the camera? Complete for half XP (+{half})</button>
                </>
              )}
            </div>
          </>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Top-left status: not in view / fix your position / good form (watch mode: just in view). */
function ViewPill({ state, watch }: { state: CounterState; watch: boolean }) {
  const [cls, icon, label] = !state.inView ? ['', 'bi-person-x', 'Not in view']
    : watch ? [' ok', 'bi-person-check', 'In view']
      : state.formOk ? [' ok', 'bi-person-check', 'Good form'] : ['', 'bi-exclamation-triangle', 'Fix your position'];
  return <span className={'cam-view-pill' + cls}><i className={'bi ' + icon}></i>{label}</span>;
}

/** Draws the detected stick figure over the video in the given colour. */
function draw(canvas: HTMLCanvasElement | null, video: HTMLVideoElement, lms: Landmark[] | undefined, color: string) {
  if (!canvas) return;
  const w = video.videoWidth, h = video.videoHeight;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  if (!lms?.length) return;
  ctx.lineWidth = Math.max(2, w / 160);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (const [a, b] of BONES) {
    const p = lms[a], q = lms[b];
    if (!p || !q || (p.visibility ?? 1) < 0.5 || (q.visibility ?? 1) < 0.5) continue;
    ctx.beginPath(); ctx.moveTo(p.x * w, p.y * h); ctx.lineTo(q.x * w, q.y * h); ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  for (const i of Object.values(LM)) {
    const p = lms[i];
    if (!p || (p.visibility ?? 1) < 0.5) continue;
    ctx.beginPath(); ctx.arc(p.x * w, p.y * h, Math.max(3, w / 120), 0, Math.PI * 2); ctx.fill();
  }
}
