/**
 * Stable patient identity — persisted in localStorage across sessions.
 * Maps to `user_id` in every /api/chat request.
 */

const STORAGE_KEY = 'aetrix_patient_id';

/**
 * Returns the stored patient UUID, or creates and stores a new one.
 * Uses crypto.randomUUID() — no polyfill needed (Chrome 92+, Firefox 95+, Safari 15.4+).
 * Synchronous — no async required.
 *
 * @returns {string} UUID v4
 */
export function getOrCreatePatientId() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;

  const id = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}
