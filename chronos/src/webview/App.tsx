import React, { useState } from 'react';

const MOCK_HISTORY = [
  {
    id: '1',
    time: '10:45 AM',
    title: 'Current Snapshot',
    description: 'Broken after async migration',
    active: true,
    diff: ['+ await paymentGateway.process()', '- paymentGateway.process()'],
  },
  {
    id: '2',
    time: '10:20 AM',
    title: 'Async Refactor',
    description: 'Introduced async workflow',
    diff: ['+ Promise.all()', '- sequential processing'],
  },
  {
    id: '3',
    time: '10:00 AM',
    title: 'Initial Commit',
    description: 'Stable baseline',
    diff: ['+ processPayment()', '+ validation'],
  },
];

export const App = () => {
  const [showDanger, setShowDanger] = useState(false);

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-brand">
          <div className="status-dot" />
          <span>Tracking</span>
        </div>

        <div className="topbar-actions">
          <button className="tab active-tab">Timeline</button>

          <button className="tab">Graph</button>

          <button className="tab">Diff</button>

          <button className="icon-btn">⚙</button>
        </div>
      </div>

      {/* HERO CARD */}
      <div className="hero-card unstable">
        <div className="hero-top">
          <div className="hero-label">CHRONOS</div>

          <div className="hero-version">Semantic Function History</div>
        </div>

        <div className="function-name">processPayment()</div>

        <div className="hero-description">
          Broken after async migration. Safe rollback available.
        </div>

        <div className="hero-meta">
          <span>3 snapshots</span>
          <span>2 downstream dependencies</span>
        </div>

        {/* SINGLE STATUS CAPSULE */}
        <div className="hero-status">Marked Unstable</div>
      </div>

      {/* TIMELINE */}
      <div className="timeline">
        {MOCK_HISTORY.map((snap) => (
          <div key={snap.id} className="snapshot-card">
            <div className="card-header">
              <div>
                <div className="snapshot-time">{snap.time}</div>

                <div className="snapshot-title">{snap.title}</div>
              </div>

              <div className={`pill ${snap.active ? 'active-pill' : ''}`}>
                {snap.active ? 'ACTIVE' : 'SAFE'}
              </div>
            </div>

            <div className="snapshot-desc">{snap.description}</div>

            <div className="diff-box">
              {snap.diff.map((line) => (
                <div
                  key={line}
                  className={`diff-line ${line.startsWith('+') ? 'added' : 'removed'}`}
                >
                  {line}
                </div>
              ))}
            </div>

            {!snap.active && (
              <div className="actions">
                <button className="secondary-btn">Preview</button>

                <button className="primary-btn" onClick={() => setShowDanger(true)}>
                  Restore
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* DANGER MODAL */}
      {showDanger && (
        <div className="floating-modal">
          <div className="modal-title">Dependency Impact</div>

          <div className="modal-subtitle">2 downstream functions affected</div>

          <div className="affected-list">
            <div>checkoutCart()</div>
            <div>generateReceipt()</div>
          </div>

          <div className="modal-actions">
            <button className="secondary-btn" onClick={() => setShowDanger(false)}>
              Cancel
            </button>

            <button className="danger-btn">Revert</button>
          </div>
        </div>
      )}
    </div>
  );
};
