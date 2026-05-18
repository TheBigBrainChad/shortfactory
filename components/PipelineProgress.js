'use client';

const STAGES = [
  { key: 'tts', icon: '🎤', label: 'TTS' },
  { key: 'transcribe', icon: '📝', label: 'Transcribe' },
  { key: 'subtitles', icon: '✨', label: 'Subtitles' },
  { key: 'render', icon: '🎬', label: 'Render' },
  { key: 'thumbnail', icon: '🖼', label: 'Thumbnail' },
  { key: 'done', icon: '✅', label: 'Done' }
];

export default function PipelineProgress({ currentStage, status }) {
  const stageOrder = STAGES.map(s => s.key);
  const currentIdx = stageOrder.indexOf(currentStage);

  return (
    <div className="pipeline-steps">
      {STAGES.map((stage, i) => {
        const isCompleted = status === 'completed' || currentIdx > i;
        const isActive = currentStage === stage.key && status === 'running';
        const isFailed = status === 'failed' && currentStage === stage.key;

        let cls = '';
        if (isFailed) cls = 'failed';
        else if (isActive) cls = 'active';
        else if (isCompleted) cls = 'completed';

        return (
          <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <div className={`pipeline-step ${cls}`}>
              <div className="step-dot">{isCompleted && !isFailed ? '✓' : stage.icon}</div>
              <div className="step-label">{stage.label}</div>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`pipeline-connector ${isCompleted ? 'completed' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}