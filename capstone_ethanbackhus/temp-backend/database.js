export const db = {
  sessions: {},

  createSession(uuid, data) {
    this.sessions[uuid] = data;
    return this.sessions[uuid];
  },

  getSession(uuid) {
    return this.sessions[uuid] || null;
  },

  updateSession(uuid, newData) {
    Object.assign(this.sessions[uuid], newData);
    return this.sessions[uuid];
  }
};
