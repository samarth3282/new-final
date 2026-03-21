/**
 * Mock chatbot service that simulates a medical chatbot backend.
 * Replace with real API endpoint when backend is ready.
 */

const MOCK_RESPONSES = {
  default: "I understand you're experiencing some health concerns. Could you tell me more about your symptoms? When did they start, and how severe would you say they are?",
  heart: "Heart-related symptoms should be taken seriously. Are you experiencing chest pain, shortness of breath, or irregular heartbeat? Please describe the exact nature of the discomfort.",
  fever: "Fever can have many causes. How high is your temperature? Are you also experiencing chills, body aches, or headaches? Have you taken any medication?",
  headache: "Headaches can range from tension to migraine. Where exactly is the pain located? Is it throbbing, sharp, or dull? Does light or sound make it worse?",
  stomach: "Digestive issues are common. Are you experiencing nausea, vomiting, diarrhea, or constipation? When did this start and have you eaten anything unusual recently?",
  breathing: "Breathing difficulties need attention. Is the shortness of breath constant or does it come and go? Do you have any chest tightness or wheezing?",
  pain: "I'd like to understand your pain better. On a scale of 1-10, how would you rate it? Is it constant or intermittent? Does anything make it better or worse?",
  skin: "Skin conditions can vary widely. Can you describe what you're seeing — is it a rash, swelling, redness, or something else? Is it itchy or painful?",
  cold: "Cold and flu symptoms are very common. Besides the cold, do you have a sore throat, runny nose, or cough? Have you been in contact with anyone who was sick?",
  cough: "A cough can indicate various conditions. Is it dry or productive (with mucus)? How long have you had it? Is it worse at night or in the morning?",
};

function findBestResponse(text) {
  const lower = text.toLowerCase();
  for (const [keyword, response] of Object.entries(MOCK_RESPONSES)) {
    if (keyword !== 'default' && lower.includes(keyword)) {
      return response;
    }
  }
  // Check for Hindi/common transliterated keywords
  if (/dil|heart|chest|seena|chhati/.test(lower)) return MOCK_RESPONSES.heart;
  if (/bukhar|fever|temperature|tapman/.test(lower)) return MOCK_RESPONSES.fever;
  if (/sir|head|sar|dard/.test(lower)) return MOCK_RESPONSES.headache;
  if (/pet|stomach|ulti|nausea/.test(lower)) return MOCK_RESPONSES.stomach;
  if (/saans|breath|dam/.test(lower)) return MOCK_RESPONSES.breathing;

  return MOCK_RESPONSES.default;
}

/**
 * Sends user message to the mock chatbot and returns a response.
 * @param {string} englishText - The user's message in English
 * @returns {Promise<string>} Bot response in English
 */
export async function sendChatMessage(englishText) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));
  return findBestResponse(englishText);
}
