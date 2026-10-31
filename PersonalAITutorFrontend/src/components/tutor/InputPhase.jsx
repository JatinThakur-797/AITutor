import { useState } from 'react';

export default function InputPhase({ formData, handleChange, onSubmit, loading, onBack }) {
  const [focused, setFocused] = useState(null);

  const fields = [
    {
      name: 'goal', label: 'Learning Goal', type: 'text',
      placeholder: 'e.g. Java Full Stack, MERN, Data Science',
      hint: 'What do you want to master?', span: 'full'
    },
    {
      name: 'currentLevel', label: 'Current Level', type: 'select',
      options: ['Nothing', 'Beginner', 'Intermediate', 'Advanced'],
      hint: 'Be honest — it helps us calibrate'
    },
    {
      name: 'timePerDay', label: 'Hours Per Day', type: 'number',
      min: 1, max: 16, placeholder: '3',
      hint: 'Minimum you can commit daily'
    },
    {
      name: 'duration', label: 'Duration (months)', type: 'number',
      min: 1, max: 24, placeholder: '6',
      hint: 'How long is your runway?'
    },
  ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0e1117] p-6 text-zinc-300">
      <div className="relative w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center animate-fade-in">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-[#00f0ff]/20 bg-[#00f0ff]/5 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" />
            <span className="text-[10px] text-[#00f0ff] font-semibold tracking-wider uppercase replit-font-mono">AI ASSISTANT</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
            Build Your Learning Path
          </h1>
          <p className="text-zinc-500 text-sm replit-font-mono">
            Answer a few questions to configure your custom workspace roadmap.
          </p>
        </div>

        {/* Form card */}
        <form onSubmit={onSubmit} className="relative">
          <div className="rounded border border-[#2e303e] bg-[#1c1e26] p-8">
            <div className="space-y-5 mb-6">
              {fields.map((field) => (
                <div key={field.name} className={field.span === 'full' ? 'col-span-2' : ''}>
                  <label className="block text-[10px] font-semibold text-zinc-500 mb-1.5 tracking-wider uppercase replit-font-mono">
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      name={field.name}
                      value={formData[field.name]}
                      onChange={handleChange}
                      onFocus={() => setFocused(field.name)}
                      onBlur={() => setFocused(null)}
                      className="w-full px-3.5 py-2.5 rounded text-white text-sm outline-none bg-[#0e1117] border border-[#2e303e] transition-all"
                      style={{
                        borderColor: focused === field.name ? '#00f0ff' : '#2e303e',
                      }}>
                      {field.options.map(o => <option key={o} value={o} className="bg-[#1c1e26]">{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      name={field.name}
                      value={formData[field.name]}
                      onChange={handleChange}
                      onFocus={() => setFocused(field.name)}
                      onBlur={() => setFocused(null)}
                      placeholder={field.placeholder}
                      min={field.min} max={field.max}
                      required
                      className="w-full px-3.5 py-2.5 rounded text-white text-sm outline-none bg-[#0e1117] border border-[#2e303e] transition-all placeholder-zinc-700"
                      style={{
                        borderColor: focused === field.name ? '#00f0ff' : '#2e303e',
                        boxShadow: focused === field.name ? '0 0 0 1px #00f0ff' : 'none',
                      }} />
                  )}
                  <p className="mt-1.5 text-[10px] text-zinc-500 replit-font-mono">{field.hint}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="replit-btn-secondary px-6 py-3 text-xs uppercase tracking-wider replit-font-mono cursor-pointer"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !formData.goal}
                className="flex-1 replit-btn-primary py-3 text-xs uppercase tracking-wider replit-font-mono cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4 text-[#00f0ff]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating quiz...
                  </span>
                ) : (
                  <span>Start Diagnostic Quiz →</span>
                )}
              </button>
            </div>
          </div>
        </form>

        <p className="mt-6 text-center text-[10px] text-zinc-600 replit-font-mono">
          10-question evaluation · AI Feasibility analysis · custom workspace generation
        </p>
      </div>
    </div>
  );
}