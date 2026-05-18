'use client';

import { useState, useEffect } from 'react';

export default function ScriptEditor({ value, onChange, readOnly }) {
  const wordCount = value ? value.trim().split(/\s+/).filter(Boolean).length : 0;
  const estimatedDuration = Math.round(wordCount / 2.5);
  const isOverLimit = wordCount > 160;

  return (
    <div className="script-editor-wrap">
      <textarea
        className="script-editor"
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        readOnly={readOnly}
        placeholder="Script will appear here..."
        rows={12}
      />
      <div className="script-stats">
        <span>{wordCount} words</span>
        <span>~{estimatedDuration}s spoken</span>
        {isOverLimit && <span className="stat-warn">⚠ Over 150 word target</span>}
        {wordCount >= 120 && wordCount <= 160 && <span style={{ color: 'var(--green)' }}>✓ Ideal length</span>}
      </div>
    </div>
  );
}