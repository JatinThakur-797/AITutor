import { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import { CheckCircle2, Clipboard, Code2, FileText, Play, RotateCcw, Save, Sparkles } from 'lucide-react';
import { Button, Badge } from './UI';

function inferLanguage(taskData) {
  const requested = String(taskData?.language || taskData?.programming_language || '').toLowerCase();
  if (requested.includes('python')) return 'python';
  if (requested.includes('javascript') || requested === 'js') return 'javascript';
  if (requested.includes('typescript') || requested === 'ts') return 'typescript';
  if (requested.includes('sql')) return 'sql';
  if (requested.includes('html')) return 'html';
  return 'java';
}

export default function TaskWorkspace({ taskType, taskData = {}, goalId, dayNumber, onComplete, completed = false }) {
  const type = String(taskType || 'ACTIVITY').toUpperCase();
  const storageKey = `pathai-draft-${goalId}-${dayNumber}`;
  const initialCode = taskData.starter_code || taskData.starterCode || taskData.code || '// Write your solution here\n';
  const [code, setCode] = useState(() => localStorage.getItem(storageKey) || initialCode);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [notes, setNotes] = useState(() => localStorage.getItem(`${storageKey}-notes`) || '');
  const language = useMemo(() => inferLanguage(taskData), [taskData]);

  useEffect(() => { setCode(localStorage.getItem(storageKey) || initialCode); setNotes(localStorage.getItem(`${storageKey}-notes`) || ''); setSelected(''); setRevealed(false); }, [storageKey, initialCode]);

  const saveDraft = () => { localStorage.setItem(storageKey, code); localStorage.setItem(`${storageKey}-notes`, notes); setSaved(true); window.setTimeout(() => setSaved(false), 1800); };
  const copyCode = async () => { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1500); };
  const resetCode = () => { setCode(initialCode); localStorage.removeItem(storageKey); };

  if (type === 'QUIZ') {
    const options = taskData.options || {};
    const correct = String(taskData.correct || taskData.correct_answer || '').trim();
    return <div className="task-workspace">
      <div className="task-title-row"><div className="task-type-icon task-purple"><Sparkles size={18} /></div><div><div className="eyebrow">KNOWLEDGE CHECK</div><h3>Test your understanding</h3></div><Badge tone="info">Quick quiz</Badge></div>
      <p className="task-instructions">{taskData.instructions || taskData.question || 'Choose the best answer.'}</p>
      {taskData.question && taskData.instructions ? <h4 className="task-question">{taskData.question}</h4> : null}
      <div className="task-options">{Object.entries(options).map(([key, value]) => <button key={key} className={`task-option ${selected === key ? 'selected' : ''} ${revealed && key === correct ? 'correct' : ''}`} disabled={revealed} onClick={() => setSelected(key)}><span>{key}</span>{value}</button>)}</div>
      {revealed ? <div className={`task-explanation ${selected === correct ? 'success' : 'notice'}`}><strong>{selected === correct ? 'Nice work — that is correct.' : `The correct answer is ${correct || 'not provided'}.`}</strong><p>{taskData.explanation || 'Review the lesson section above and try a similar example.'}</p></div> : <Button disabled={!selected} onClick={() => setRevealed(true)}>Check answer <CheckCircle2 size={16} /></Button>}
      {revealed && onComplete ? <Button variant="secondary" onClick={onComplete} disabled={completed}>{completed ? 'Day completed' : 'Mark day complete'}</Button> : null}
    </div>;
  }

  if (type === 'CODING') {
    return <div className="task-workspace coding-workspace">
      <div className="task-title-row"><div className="task-type-icon task-blue"><Code2 size={18} /></div><div><div className="eyebrow">HANDS-ON PRACTICE</div><h3>Code it yourself</h3></div><Badge tone="info">{language}</Badge></div>
      <p className="task-instructions">{taskData.instructions || taskData.description || 'Complete the coding exercise using the editor below.'}</p>
      {taskData.expected_output ? <div className="expected-output"><span>EXPECTED OUTPUT</span><code>{taskData.expected_output}</code></div> : null}
      <div className="editor-toolbar"><span><i className="editor-dot" /> main.{language === 'java' ? 'java' : language === 'python' ? 'py' : language === 'typescript' ? 'ts' : 'js'}</span><div><button onClick={resetCode}><RotateCcw size={14} /> Reset</button><button onClick={copyCode}><Clipboard size={14} /> {copied ? 'Copied' : 'Copy'}</button><button onClick={saveDraft}><Save size={14} /> {saved ? 'Saved' : 'Save draft'}</button></div></div>
      <div className="monaco-wrap"><Editor height="340px" language={language} theme="vs-dark" value={code} onChange={(value) => setCode(value ?? '')} options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on', scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4, padding: { top: 14 }, wordWrap: 'on', smoothScrolling: true }} /></div>
      <div className="editor-actions"><div className="editor-info"><span className="editor-status-dot" /> Draft saved in this browser when you click Save draft</div><Button variant="secondary" onClick={() => { saveDraft(); }}><Save size={15} /> Save work</Button></div>
      <div className="execution-notice"><Play size={15} /><span><strong>Code execution is not connected yet.</strong> Your current backend has no code-runner endpoint. You can edit, save, and copy your solution here; the Run action requires a sandboxed execution service.</span></div>
      {onComplete ? <Button onClick={onComplete} disabled={completed}>{completed ? 'Day completed' : 'Mark practice complete' } <CheckCircle2 size={16} /></Button> : null}
    </div>;
  }

  return <div className="task-workspace">
    <div className="task-title-row"><div className="task-type-icon task-green"><FileText size={18} /></div><div><div className="eyebrow">PRACTICE & REFLECTION</div><h3>Put the idea into words</h3></div><Badge tone="success">Activity</Badge></div>
    <p className="task-instructions">{taskData.instructions || taskData.description || 'Write a short explanation, sketch a solution, or note how you would apply this concept in a real project.'}</p>
    <textarea className="input activity-notes" rows="7" placeholder="Write your approach, example, or notes here…" value={notes} onChange={(e) => setNotes(e.target.value)} />
    <div className="editor-actions"><span className="editor-info">Your notes are stored locally in this browser.</span><Button variant="secondary" onClick={saveDraft}><Save size={15} /> {saved ? 'Saved' : 'Save notes'}</Button></div>
    {onComplete ? <Button onClick={onComplete} disabled={completed}>{completed ? 'Day completed' : 'Mark activity complete'} <CheckCircle2 size={16} /></Button> : null}
  </div>;
}
