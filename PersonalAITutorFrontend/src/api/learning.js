import { api } from './client';

export const learningApi = {
  startAssessment: (payload) => api.post('/api/path/testSkills', payload).then((r) => r.data),
  checkFeasibility: (payload) => api.post('/api/path/feasibility', payload).then((r) => r.data),
  generateRoadmap: (startDay = 1, days = 7) => api.post('/api/path/roadmap', null, { params: { startDay, days } }).then((r) => r.data),
  getGoals: () => api.get('/api/path/goals').then((r) => r.data),
  getRoadmapDays: (goalId) => api.get(`/api/path/roadmap/${goalId}/days`).then((r) => r.data),
  getLesson: (goalId, day) => api.get(`/api/path/roadmap/${goalId}/day/${day}/lesson`).then((r) => r.data),
  completeDay: (goalId, day) => api.patch(`/api/path/roadmap/${goalId}/day/${day}/complete`).then((r) => r.data),
  askMentor: (payload) => api.post('/api/path/chat', payload).then((r) => r.data),
  streamMentor: async (payload, { onToken, signal } = {}) => {
    const response = await fetch(`${api.defaults.baseURL}/api/path/chat/stream`, {
      method: 'POST',
      credentials: 'include',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(localStorage.getItem('pathai_access_token') ? { Authorization: `Bearer ${localStorage.getItem('pathai_access_token')}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Streaming endpoint returned HTTP ${response.status}`);
    if (!response.body) throw new Error('Streaming response body is unavailable.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let completed = false;
    const consume = (block) => {
      let event = 'message';
      const data = [];
      for (const line of block.split(/\r?\n/)) {
        if (!line || line.startsWith(':')) continue;
        const i = line.indexOf(':');
        const key = i < 0 ? line : line.slice(0, i);
        const value = i < 0 ? '' : line.slice(i + 1).replace(/^ /, '');
        if (key === 'event') event = value;
        if (key === 'data') data.push(value);
      }
      const value = data.join('\n');
      if (event === 'token') onToken?.(value);
      if (event === 'done') completed = true;
      if (event === 'error') throw new Error(value || 'AI stream failed.');
    };
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || '';
        events.forEach(consume);
      }
      buffer += decoder.decode();
      if (buffer.trim()) consume(buffer);
      if (!completed) throw new Error('AI stream ended without a completion event.');
    } finally {
      reader.releaseLock();
    }
  },
};
