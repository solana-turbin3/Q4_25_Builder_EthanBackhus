import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export async function createSession(payload) {
  const res = await axios.post(`${API_BASE}/api/create-session`, payload);
  return res.data;
}

export async function getSession(uuid) {
  const res = await axios.get(`${API_BASE}/api/get-session/${encodeURIComponent(uuid)}`);
  return res.data;
}

export async function getSolanaPay(uuid) {
  const res = await axios.get(`${API_BASE}/api/solana-pay/${encodeURIComponent(uuid)}`);
  return res.data;
}

export async function startPayout(uuid, body) {
  const res = await axios.post(`${API_BASE}/api/start-payout/${encodeURIComponent(uuid)}`, body || {});
  return res.data;
}
