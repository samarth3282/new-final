/**
 * Real chatbot service — connects to the FastAPI /api/chat endpoint.
 * Use native fetch() only; no axios.
 */

const BASE_URL = import.meta.env.VITE_CHATBOT_API_URL || 'http://localhost:8000';

/**
 * Sends a message to the chatbot backend.
 *
 * @param {{ user_id: string, session_id: string|null, message: string, lat: number|null, lng: number|null }} params
 * @returns {Promise<object>} Parsed OutputResponse from the backend
 * @throws {{ status: number, detail: string }} On non-2xx or network failure
 */
export async function sendChatMessage({ user_id, session_id, message, lat, lng }) {
  let response;
  try {
    response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, session_id, message, lat, lng }),
    });
  } catch {
    throw { status: 0, detail: 'Network error — chatbot unreachable' };
  }

  if (response.ok) {
    return await response.json();
  }

  let errorBody = {};
  try {
    errorBody = await response.json();
  } catch {
    // non-JSON error body — ignore
  }
  throw { status: response.status, detail: errorBody.detail || 'Unknown error' };
}

