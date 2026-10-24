// The opt-in ranking board: everyone who joined, ranked by level (then total XP).
// Accounts are never added automatically; joining and leaving both ask first.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useBsModal } from '../shared/components/useBsModal';
import { rankBoard, rankOf } from './derive';
import { RankBadge } from './RankBadge';
import { exerciseStore, type ExerciseState } from './store';

const MEDALS = ['🥇', '🥈', '🥉'];

export function RankingView({ state, uid }: { state: ExerciseState; uid: string }) {
  const modal = useBsModal();
  const [action, setAction] = useState<'join' | 'leave'>('join');
  const rows = rankBoard(state.board);
  const me = rows.find(r => r.uid === uid);
  const ask = (a: 'join' | 'leave') => { setAction(a); modal.show(); };

  return (
    <>
      <div className="card-x fade-in board-intro">
        <div className="board-intro-icon"><i className="bi bi-trophy"></i></div>
        <div className="min-w-0">
          {me ? <>
            <div className="board-intro-title">You’re #{me.place} of {rows.length}</div>
            <div className="head-note">Your level and XP update here automatically. You can leave any time.</div>
          </> : <>
            <div className="board-intro-title">Join the ranking board</div>
            <div className="head-note">Compete with everyone who joined, ranked by level. You’re not on it unless you join.</div>
          </>}
        </div>
        {state.usingLocal
          ? <span className="head-note ms-auto">Needs a connection</span>
          : me
            ? <button type="button" className="btn btn-ghost btn-sm ms-auto" onClick={() => ask('leave')}>Leave</button>
            : <button type="button" className="btn-primary-x btn-sm-x ms-auto" onClick={() => ask('join')}>Join</button>}
      </div>

      <div className="card-x fade-in">
        <div className="card-x-head">
          <h2 className="card-x-title"><i className="bi bi-bar-chart-steps"></i>Ranking</h2>
          <span className="head-note">{rows.length} player{rows.length === 1 ? '' : 's'}</span>
        </div>
        <div className="card-x-body list-rows">
          {!state.boardReady && <div className="text-center py-3"><div className="spinner-border spinner-border-sm" role="status"><span className="visually-hidden">Loading</span></div></div>}
          {state.boardReady && !rows.length && <div className="empty"><h3>No one has joined yet</h3><p>Be the first on the board.</p></div>}
          {rows.map(r => {
            const rank = rankOf(r.level);
            return (
              <div key={r.uid} className={'board-row' + (r.uid === uid ? ' me' : '')}>
                <div className="board-place">{r.place <= 3 ? <span className="medal" aria-label={'#' + r.place}>{MEDALS[r.place - 1]}</span> : '#' + r.place}</div>
                <RankBadge rank={rank} size={42} className="board-badge" />
                <div className="board-who min-w-0">
                  <div className="board-name">{r.username}{r.uid === uid && <span className="you-tag">You</span>}</div>
                  <div className="hist-sub">{rank.label}</div>
                </div>
                <div className="board-score">
                  <div className="board-level">Lv {r.level}</div>
                  <div className="hist-sub">{r.xp} XP</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {createPortal(
        <div className="modal fade" id="boardModal" tabIndex={-1} ref={modal.ref}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-body text-center p-4">
                <div className="board-modal-icon"><i className={'bi ' + (action === 'join' ? 'bi-trophy' : 'bi-box-arrow-right')}></i></div>
                <div className="fw-bold mb-2">{action === 'join' ? 'Join the ranking board?' : 'Leave the ranking board?'}</div>
                <div className="head-note">
                  {action === 'join'
                    ? 'Your username, level, rank and total XP will be visible to every signed-in user. You can leave any time.'
                    : 'You’ll be removed from the board. Your level and XP stay in your account, and you can join again later.'}
                </div>
              </div>
              <div className="modal-footer border-0 pt-0 justify-content-center">
                <button type="button" className="btn btn-ghost" data-bs-dismiss="modal">Cancel</button>
                <button type="button" className="btn-primary-x btn-sm-x" onClick={() => {
                  modal.hide();
                  if (action === 'join') exerciseStore.joinBoard(); else exerciseStore.leaveBoard();
                }}>{action === 'join' ? 'Join' : 'Leave'}</button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
