import { api, TOKEN_KEY } from "./client";

function extractStreamToken(rawValue) {
  if (!rawValue) return "";
  const trimmedStart = rawValue.trimStart();
  if (trimmedStart.startsWith("{") || trimmedStart.startsWith('"')) {
    try {
      const parsed = JSON.parse(rawValue);
      if (typeof parsed === "string") return parsed;
      if (parsed && typeof parsed === "object") {
        return String(
          parsed.token ??
            parsed.content ??
            parsed.delta ??
            parsed.response ??
            parsed.text ??
            "",
        );
      }
    } catch {
      // Not complete/valid JSON; return raw SSE payload as-is
    }
  }
  return rawValue;
}

export const learningApi = {
  startAssessment: (payload) =>
    api.post("/api/path/testSkills", payload).then((r) => r.data),

  checkFeasibility: (payload, goalId) =>
    api
      .post("/api/path/feasibility", payload, {
        params: goalId ? { goalId } : undefined,
      })
      .then((r) => r.data),

  generateRoadmap: (startDay = 1, days = 7, goalId) =>
    api
      .post("/api/path/roadmap", null, {
        params: { startDay, days, ...(goalId ? { goalId } : {}) },
      })
      .then((r) => r.data),

  getGoals: () => api.get("/api/path/goals").then((r) => r.data),

  getGoalById: (goalId) =>
    api.get(`/api/path/goals/${goalId}`).then((r) => r.data),

  getRoadmapDays: (goalId) =>
    api.get(`/api/path/roadmap/${goalId}/days`).then((r) => r.data),

  getLesson: (goalId, day) =>
    api
      .get(`/api/path/roadmap/${goalId}/day/${day}/lesson`)
      .then((r) => r.data),

  completeDay: (goalId, day) =>
    api
      .patch(`/api/path/roadmap/${goalId}/day/${day}/complete`)
      .then((r) => r.data),

  deleteGoal: (goalId) =>
    api.delete(`/api/path/goals/${goalId}`).then((r) => r.data),

  askMentor: (payload) =>
    api.post("/api/path/chat", payload).then((r) => r.data),

  streamMentor: async (payload, { onToken, signal } = {}) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const response = await fetch(
      `${api.defaults.baseURL}/api/path/chat/stream`,
      {
        method: "POST",
        credentials: "include",
        signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      throw new Error(`Streaming endpoint returned HTTP ${response.status}`);
    }
    if (!response.body) {
      throw new Error("Streaming response body is unavailable.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let completed = false;

    const consume = (block) => {
      let event = "message";
      const dataLines = [];
      for (const line of block.split(/\r?\n/)) {
        if (!line || line.startsWith(":")) continue;
        const colonIdx = line.indexOf(":");
        const key = colonIdx < 0 ? line : line.slice(0, colonIdx);
        // Per SSE spec, strip at most one leading space after ':'
        const value =
          colonIdx < 0 ? "" : line.slice(colonIdx + 1).replace(/^ /, "");
        if (key === "event") event = value.trim();
        if (key === "data") dataLines.push(value);
      }

      const joined = dataLines.join("\n");
      if (!joined || joined === "[DONE]") {
        if (event === "done" || joined === "[DONE]") completed = true;
        return;
      }

      if (event === "token" || event === "message") {
        const piece = extractStreamToken(joined);
        if (piece) onToken?.(piece);
      } else if (event === "done") {
        completed = true;
      } else if (event === "error") {
        throw new Error(joined || "AI stream failed.");
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || "";
        events.forEach(consume);
      }
      buffer += decoder.decode();
      if (buffer.trim()) consume(buffer);
      if (!completed) {
        completed = true;
      }
    } finally {
      reader.releaseLock();
    }
  },
};
