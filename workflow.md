# INTEGRATION WORKFLOW PLAN

> **FastAPI Chatbot Backend ↔ React/Vite Frontend**
> Multilingual Healthcare Triage Application — AETRIX

---

## PHASE 0: Pre-flight (config changes)

### 0.1 — CORS: `FRONTEND/chatbot/config.py`

| Item | Detail |
|------|--------|
| **File** | `FRONTEND/chatbot/config.py` |
| **Line** | `CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "*").split(",")` |
| **Current behaviour** | Default `"*"` → `["*"]` (permissive). If `.env` overrides `CORS_ORIGINS` with specific origins, `http://localhost:5173` may be missing. |
| **Action** | Open `FRONTEND/chatbot/.env`. If `CORS_ORIGINS` is set explicitly, append `http://localhost:5173`. If unset (using `"*"` default), no code change needed — optionally add `CORS_ORIGINS=http://localhost:5173` to `.env` for production safety. |
| **Verify** | Start FastAPI server → browser console shows no CORS errors on `/api/chat`. |

### 0.2 — Frontend env: `FRONTEND/main_frontend/.env`

| Item | Detail |
|------|--------|
| **Add** | `VITE_CHATBOT_API_URL=http://localhost:8000` |
| **Purpose** | Avoids hardcoding the chatbot URL; enables dev → staging → prod swaps. |
| **Fallback** | If team prefers no env var, hardcode `"http://localhost:8000"` in `chatbotService.js`. |

### 0.3 — Required i18n keys (add to ALL language files)

**Files to modify:** `en.json`, `hi.json`, `gu.json`, `mr.json`, `ta.json` in `FRONTEND/main_frontend/src/i18n/`

The following keys **must** be added to every locale file before implementation begins. English values are provided below — translate appropriately for each language file.

| Key | English value |
|-----|---------------|
| `emergency.call_ambulance` | `"Call Ambulance"` |
| `emergency.send_sms` | `"Send SMS Alert"` |
| `emergency.call_success` | `"Emergency services have been notified successfully."` |
| `emergency.call_failed` | `"Failed to contact emergency services. Please try again."` |
| `chatbot.session_complete` | `"This session is complete."` |
| `chatbot.start_new_chat` | `"Start New Chat"` |

**Note:** This modifies the i18n **data files** (JSON), not `I18nContext.jsx` (the React context logic). This is within constraints.

---

## PHASE 1: `patientId.js` (new file)

| Item | Detail |
|------|--------|
| **File to create** | `FRONTEND/main_frontend/src/utils/patientId.js` |
| **Export** | `getOrCreatePatientId()` (named export) |
| **Return type** | `string` — UUID v4 |
| **localStorage key** | `"aetrix_patient_id"` |

### Logic

```
getOrCreatePatientId()
  ├─ Read localStorage.getItem("aetrix_patient_id")
  ├─ If non-empty string → return it
  └─ If null/empty
       ├─ id = crypto.randomUUID()
       ├─ localStorage.setItem("aetrix_patient_id", id)
       └─ return id
```

### Notes

- `crypto.randomUUID()` — Chrome 92+, Firefox 95+, Safari 15.4+. No polyfill needed.
- Synchronous — no `async` required.
- **Independent of `UserContext`** (which has no `_id` field).
- Maps to `user_id` in every `/api/chat` request.

---

## PHASE 2: `chatbotService.js` (full replacement)

| Item | Detail |
|------|--------|
| **File** | `FRONTEND/main_frontend/src/utils/chatbotService.js` |
| **Action** | Delete all mock code. Replace entirely. |

### Exported Function

```
sendChatMessage({ user_id, session_id, message, lat, lng }) → Promise<OutputResponse>
```

### Request Shape (POST body → JSON)

```json
{
  "user_id":    "string (required, 1–128 chars)",
  "session_id": "string | null (optional, echoed back by server)",
  "message":    "string (required, English, 1–4096 chars)",
  "lat":        "float | null (optional)",
  "lng":        "float | null (optional)"
}
```

### Response Shape (parsed JSON — backend `OutputResponse`)

```json
{
  "output_type":      "query | answer | suggestions | clinic | emergency",
  "urgency_label":    "Self-care | Visit clinic | Emergency | null",
  "message":          "string",
  "action_items":     ["string", "..."],
  "hospital_info":    [{ "name", "address", "distance_km", "phone", "open_now", "lat", "lng" }] | null,
  "disclaimer":       "string | null",
  "session_complete": true | false,
  "session_id":       "string",
  "session_summary":  {} | null,
  "total_summary":    {} | null
}
```

### Implementation Rules

- **Use native `fetch()`** — no axios.
- **Base URL:** `import.meta.env.VITE_CHATBOT_API_URL || "http://localhost:8000"`
- **Headers:** `Content-Type: application/json`
- **On HTTP 2xx →** `return await response.json()`
- **On non-2xx →** Parse error body (`{ error, detail, session_id }`) and throw `{ status: response.status, detail: parsedBody.detail || "Unknown error" }`
- **On network failure →** throw `{ status: 0, detail: "Network error — chatbot unreachable" }`

---

## PHASE 3: `ChatBot.jsx` (integration wiring)

**File:** `FRONTEND/main_frontend/src/pages/patient/ChatBot.jsx`

> **Preserved as-is:** `QUESTION_FLOW` array, `speakIfVoiceMode()`, all `ask___()` functions,
> `handleOptionSelect()`, `handleSkip()`, `handleComorbidityYes()`, `addBotMessage()`,
> `addUserMessage()`, `addTypingIndicator()`, `removeTypingIndicator()`, `markAnswered()`,
> `checkEmergencyKeywords()`.
>
> **Delete:** `translateServerResponse()` — its functionality is fully replaced by
> `translateAndDisplay()` (Phase 5). Remove the function definition and all call sites.

### Step 3.1 — New / changed imports

```
+ import { getOrCreatePatientId } from '../../utils/patientId';
  import { sendChatMessage } from '../../utils/chatbotService';   // now real, same path
- import { mockHospitals, mockDiagnosisResult, EMERGENCY_KEYWORDS } from '../../utils/mockData';
+ import { EMERGENCY_KEYWORDS } from '../../utils/mockData';       // keep only this
- import { postTriage } from '../../utils/api';
- import { generateReport } from '../../utils/reportGenerator';
```

### Step 3.2 — New component-level state

```js
// Patient ID — stable across sessions, from localStorage
const [patientId] = useState(() => getOrCreatePatientId());

// Session ID — see Step 3.4 for init logic
const [sessionId, setSessionId] = useState(() => { /* ... */ });

// Geolocation
const [userLat, setUserLat]       = useState(null);
const [userLng, setUserLng]       = useState(null);

// Hospital data from chatbot (replaces mockHospitals)
const [hospitalData, setHospitalData] = useState(null);

// Free-chat mode (active when output_type === "query")
const [isFreeChatMode, setIsFreeChatMode] = useState(false);

// Session lifecycle
const [sessionComplete, setSessionComplete] = useState(false);

// Emergency call state
const [emergencyLoading, setEmergencyLoading] = useState(false);
const [emergencySuccess, setEmergencySuccess] = useState(false);
```

### Step 3.3 — Geolocation on mount

```
useEffect (runs once):
  ├─ navigator.geolocation.getCurrentPosition(
  │    success → setUserLat(coords.latitude), setUserLng(coords.longitude)
  │    error   → console.warn, lat/lng stay null
  │  )
  └─ (no toast on denial — chatbot still works without location)
```

### Step 3.4 — Session ID initialization on mount

```
useEffect (runs once) OR useState initializer:
  ├─ Read localStorage.getItem("aetrix_session_id")
  ├─ Read localStorage.getItem("aetrix_session_complete")
  ├─ If no session ID stored OR session_complete === "true":
  │    ├─ newId = crypto.randomUUID()
  │    ├─ localStorage.setItem("aetrix_session_id", newId)
  │    ├─ localStorage.removeItem("aetrix_session_complete")
  │    └─ setSessionId(newId)
  └─ Else: use stored session ID
```

### Step 3.5 — `buildSummaryMessage()` helper

```
function buildSummaryMessage() → string

Reads: symptomDataRef.current, state.profile

Returns:
  "Patient symptoms: [symptoms.join(', ')].
   Severity: [symptom_severity || 'unknown'].
   Duration: [duration || 'unknown'].
   Age: [patient_age_risk || state.profile.age || 'unknown'].
   Gender: [state.profile.gender || 'unknown'].
   Comorbidities: [comorbidities || 'none']."
```

### Step 3.6 — Replace `handleDiagnose()` → `sendToRealChatbot()`

**Remove:** `handleDiagnose()` (calls `postTriage()` + `navigate('/patient/result')`).

**Add:**

```
async function sendToRealChatbot():
  ├─ setIsAnalysing(true)
  ├─ typingId = addTypingIndicator()
  ├─ summaryMessage = buildSummaryMessage()
  │
  ├─ TRY:
  │    ├─ response = await sendChatMessage({
  │    │     user_id: patientId,
  │    │     session_id: sessionId,
  │    │     message: summaryMessage,
  │    │     lat: userLat,
  │    │     lng: userLng
  │    │  })
  │    ├─ removeTypingIndicator(typingId)
  │    ├─ setSessionId(response.session_id)
  │    ├─ localStorage.setItem("aetrix_session_id", response.session_id)
  │    ├─ if response.session_complete:
  │    │     localStorage.setItem("aetrix_session_complete", "true")
  │    │     setSessionComplete(true)
  │    └─ handleChatbotResponse(response)
  │
  ├─ CATCH (err):
  │    ├─ removeTypingIndicator(typingId)
  │    ├─ addToast(t('common.error'), 'error')
  │    └─ console.error("Chatbot API error:", err)
  │
  └─ FINALLY:
       └─ setIsAnalysing(false)
```

### Step 3.7 — `handleChatbotResponse(response)` — response router

```
async function handleChatbotResponse(response):

  switch (response.output_type):

    case "query":
      ├─ await translateAndDisplay(response)
      ├─ setIsFreeChatMode(true)
      └─ (do NOT end session)

    case "answer":
      ├─ await translateAndDisplay(response)
      └─ setSessionComplete(true)

    case "suggestions":
      ├─ await translateAndDisplay(response)    // includes action_items + disclaimer
      └─ setSessionComplete(true)

    case "clinic":
      ├─ await translateAndDisplay(response)    // includes action_items + disclaimer
      ├─ if response.hospital_info?.length > 0:
      │     setHospitalData(normalizeHospitals(response.hospital_info))
      │     setShowHospitals(true)
      └─ setSessionComplete(true)

    case "emergency":
      ├─ setShowEmergency(true)
      ├─ await translateAndDisplay(response)
      ├─ if response.hospital_info?.length > 0:
      │     setHospitalData(normalizeHospitals(response.hospital_info))
      │     setShowHospitals(true)
      └─ setSessionComplete(true)
```

### Step 3.8 — Free-form reply handler (multi-turn for `output_type: "query"`)

> **⚠️ CRITICAL PLACEMENT:** The `isFreeChatMode` check must go AFTER the
> translation-to-English block in both `handleUserSend()` and `handleVoiceMessage()`,
> not at the very top. If placed before translation, `englishText` will still be
> the untranslated non-English text.

```
In handleUserSend():

  // 1. Display user message (already done at top)
  // 2. Translate to English (existing block):
  let englishText = text;
  if (lang !== 'en') { englishText = await translateToEnglish(text, ...); }

  // 3. THEN check free-chat mode — englishText is now guaranteed English:
  if (isFreeChatMode) {
    await handleFreeChatReply(englishText);
    return;
  }
  // 4. ... existing QUESTION_FLOW logic continues below

---

In handleVoiceMessage(englishText, originalText, langCode):
  // englishText is ALREADY English (ChatInput did STT + translate)

  // 1. Display user message (already done at top)

  // 2. Check free-chat mode:
  if (isFreeChatMode) {
    await handleFreeChatReply(englishText);
    return;
  }
  // 3. ... existing QUESTION_FLOW logic continues below
```

```
async function handleFreeChatReply(englishText):
  ├─ typingId = addTypingIndicator()
  ├─ TRY:
  │    ├─ response = await sendChatMessage({
  │    │     user_id: patientId,
  │    │     session_id: sessionId,
  │    │     message: englishText,
  │    │     lat: userLat, lng: userLng
  │    │  })
  │    ├─ removeTypingIndicator(typingId)
  │    ├─ Persist session_id to state + localStorage
  │    ├─ handleChatbotResponse(response)
  │    └─ if response.output_type !== "query" → setIsFreeChatMode(false)
  │
  └─ CATCH (err):
       ├─ removeTypingIndicator(typingId)
       └─ addToast(t('common.error'), 'error')
```

### Step 3.9 — `normalizeHospitals()` — data shape adapter

Backend `HospitalInfo` → Frontend `HospitalCard` prop shape:

| Backend field | Frontend field | Transform |
|---------------|---------------|-----------|
| *(none)* | `id` | `index + 1` |
| `name` | `name` | pass through |
| `address` | `address` | pass through |
| `distance_km` | `distance` | `"${distance_km.toFixed(1)} km"` |
| `phone` | `phone` | pass through |
| `open_now` | `hours` | `true → "Open Now"`, `false → "Closed"`, `null → "Unknown"` |
| *(none)* | `type` | `"hospital"` (default) |
| `lat` | `lat` | pass through |
| `lng` | `lng` | pass through |

### Step 3.10 — Update "Diagnose Now" button

```diff
- onClick={handleDiagnose}
+ onClick={sendToRealChatbot}
```

Also hide/disable when `sessionComplete === true`.

### Step 3.11 — Update EmergencyBanner + HospitalCarousel wiring

```diff
  <EmergencyBanner
-   onCallAmbulance={handleCallAmbulance}
+   onCallAmbulance={handleEmergencyCall}
    onSeeHospitals={() => setShowHospitals(!showHospitals)}
  />

  <HospitalCarousel
-   hospitals={mockHospitals}
+   hospitals={hospitalData || []}
-   onBookAmbulance={handleBookAmbulance}
+   onBookAmbulance={handleEmergencyCall}
  />
```

### Step 3.12 — Session ID read/write lifecycle

```
Mount        → Read from localStorage (Step 3.4)
After /api/chat → Write response.session_id to localStorage
session_complete: true → Write "true" to localStorage "aetrix_session_complete"
Next mount   → If "aetrix_session_complete" === "true" → generate fresh session, clear flag
```

### Step 3.13 — Remove old navigation + dispatch

```diff
- navigate('/patient/result');
- dispatch({ type: 'SET_DIAGNOSIS', payload: result });
```

Keep `navigate` import + `useNavigate()` — still used by the back button (`onClick={() => navigate('/')}`).

### Step 3.14 — Disable ChatInput when session ends (REQUIRED)

Pass `sessionComplete` into the `ChatInput` disabled prop:

```diff
  <ChatInput
    onSend={handleUserSend}
    onVoiceMessage={handleVoiceMessage}
-   disabled={isAnalysing || isSpeaking}
+   disabled={isAnalysing || isSpeaking || sessionComplete}
    mode={chatMode}
    onModeChange={setChatMode}
  />
```

Without this, the user can still type into a dead session with no handler — causing silent failures.

### Step 3.15 — "Start New Chat" button (REQUIRED)

When `sessionComplete === true`, render a "Start New Chat" button in the chat area (below the last message, above the disabled input). This is **not optional** — without it the user has no way forward after a session ends.

**Button handler — `handleStartNewChat()`:**

```
function handleStartNewChat():
  ├─ 1. localStorage.removeItem("aetrix_session_complete")
  ├─ 2. newId = crypto.randomUUID()
  │     localStorage.setItem("aetrix_session_id", newId)
  │     setSessionId(newId)
  ├─ 3. setMessages([])                          // clears chat — greeting will re-trigger
  ├─ 4. symptomDataRef.current = {               // reset to initial shape
  │       symptoms: [],
  │       symptom_severity: null,
  │       symptom_count: 1,
  │       duration: null,
  │       patient_age_risk: null,
  │       comorbidity_flag: null,
  │       comorbidities: '',
  │     }
  ├─ 5. Reset state:
  │     setSessionComplete(false)
  │     setIsFreeChatMode(false)
  │     setShowEmergency(false)
  │     setShowHospitals(false)
  │     setHospitalData(null)
  │     setQuestionsAnswered(0)
  │     setCurrentQuestion(-1)
  │     setSymptomCollected(false)
  │     setEmergencySuccess(false)
  └─ 6. Re-trigger greeting (the existing useEffect on mount adds the greeting
         when messages is empty — OR manually call addBotMessage with the greeting)
```

**JSX placement:**

```
{sessionComplete && (
  <div className="sticky bottom-[72px] flex justify-center px-4 pb-2 z-30">
    <button onClick={handleStartNewChat} className="btn-primary">
      {t('chatbot.start_new_chat')}
    </button>
  </div>
)}
```
---

## PHASE 4: Emergency Flow

**New function:** `async function handleEmergencyCall()` in `ChatBot.jsx`

### Full Step-by-Step

```
handleEmergencyCall():
  │
  ├─ 1. setEmergencyLoading(true)
  │
  ├─ 2. REVERSE GEOCODE
  │     ├─ if userLat != null && userLng != null:
  │     │     TRY:
  │     │       fetch("https://nominatim.openstreetmap.org/reverse
  │     │              ?lat=${userLat}&lon=${userLng}&format=json",
  │     │              { headers: { 'User-Agent': 'AetrixHealthApp/1.0' } })
  │     │       → addressString = data.display_name
  │     │     CATCH:
  │     │       → addressString = "${userLat}, ${userLng}"
  │     └─ else:
  │           → addressString = "Location unavailable"
  │
  ├─ 3. BUILD USER NAME
  │     ├─ if state.profile.preferredName → userName = state.profile.preferredName
  │     └─ else                           → userName = "Unknown Patient"
  │     NOTE: UserContext has NO firstName/lastName fields.
  │           LOAD_AUTH_USER only hydrates preferredName.
  │
  ├─ 4. POST TO EMERGENCY API
  │     fetch("https://muddy-wynn-codeshunt-c2861863.koyeb.app/call/emergency", {
  │       method: "POST",
  │       headers: { "Content-Type": "application/json" },
  │       body: JSON.stringify({ name: userName, location: addressString })
  │     })
  │
  ├─ 5. ON HTTP 2xx (SUCCESS):
  │     ├─ setEmergencyLoading(false)
  │     ├─ setEmergencySuccess(true)
  │     ├─ addToast(t('emergency.call_success'), 'success')
  │     └─ Disable button (prevent double-send)
  │
  └─ 6. ON FAILURE (non-2xx or network error):
        ├─ setEmergencyLoading(false)
        ├─ addToast(t('emergency.call_failed'), 'error')
        └─ Button stays enabled → user can retry
```

### UI: Emergency Action Buttons

When `output_type === "emergency"`, render two buttons (inside the chat or below `EmergencyBanner`):

| Button | Label | Handler |
|--------|-------|---------|
| Call Ambulance | `t('emergency.call_ambulance')` | `handleEmergencyCall()` |
| Send SMS | `t('emergency.send_sms')` | `handleEmergencyCall()` |

Both call the same function — the backend API handles both ambulance dispatch and SMS.

---

## PHASE 5: Translation + TTS Pipeline

**New helper:** `async function translateAndDisplay(response)` in `ChatBot.jsx`

### Data Flow Diagram

```
Backend Response (English)
  │
  ├── response.message ─────────────────────┐
  ├── response.action_items[] ──────────────┤
  └── response.disclaimer ─────────────────┤
                                            │
                              ┌─────────────▼──────────────┐
                              │   lang === 'en' ?          │
                              │   YES → pass through       │
                              │   NO  → translateFromEng() │
                              └─────────────┬──────────────┘
                                            │
                              ┌─────────────▼──────────────┐
                              │   Build display text:      │
                              │   message                  │
                              │   + numbered action_items  │
                              │   + ⚠️ disclaimer          │
                              └─────────────┬──────────────┘
                                            │
                         ┌──────────────────┼──────────────────┐
                         ▼                  ▼                  ▼
                   addBotMessage()    speakIfVoiceMode()   (hospital_info
                   (full text)        (message only)        handled separately
                                                            by HospitalCarousel)
```

### Step-by-Step

```
translateAndDisplay(response):

  1. TRANSLATE response.message
     ├─ if lang === 'en' → translatedMessage = response.message
     ├─ else → TRY translateFromEnglish(response.message, SARVAM_LANG_CODES[lang])
     └─ CATCH → translatedMessage = response.message (English fallback, console.error)

  2. TRANSLATE response.action_items[]
     ├─ if lang === 'en' OR array empty → translatedItems = response.action_items
     └─ else → Promise.all(
                 response.action_items.map(item =>
                   translateFromEnglish(item, SARVAM_LANG_CODES[lang])
                     .catch(() => item)          // per-item fallback
                 )
               )

  3. TRANSLATE response.disclaimer
     ├─ if lang === 'en' OR disclaimer null → translatedDisclaimer = response.disclaimer
     └─ else → TRY translateFromEnglish(...) CATCH → English fallback

  4. BUILD DISPLAY TEXT
     ├─ text = translatedMessage
     ├─ if translatedItems.length > 0:
     │     text += "\n\n" + translatedItems.map((item, i) => `${i+1}. ${item}`).join("\n")
     └─ if translatedDisclaimer:
           text += "\n\n⚠️ " + translatedDisclaimer

  5. DISPLAY
     └─ addBotMessage(text)

  6. TTS (voice mode only)
     └─ speakIfVoiceMode(translatedMessage)     // main message only, not items/disclaimer
```

### Translation Rules Summary

| Direction | When | Function | Fallback |
|-----------|------|----------|----------|
| User → English | Before every API call | `translateToEnglish()` | Use original text |
| English → User | After every API response | `translateFromEnglish()` | Display English |
| Skip translation | `lang === 'en'` | Pass through | N/A |

### What is NOT translated

- Hospital `name`, `address`, `distance`, `phone` (rendered by `HospitalCarousel` separately)
- Session IDs, urgency labels (internal use only)

---

## PHASE 6: Edge Case Handling

| ID | Edge Case | Handling Strategy |
|--------|-----------|-------------------|
| **EC-01** | **Geolocation denied** → lat/lng null | `getCurrentPosition` error callback logs to console. `userLat`/`userLng` remain `null`. `sendChatMessage()` sends `lat: null, lng: null`. Backend returns no `hospital_info`. `HospitalCarousel` not rendered (gated by `hospitalData?.length > 0`). Emergency flow uses `"Location unavailable"` as fallback address. |
| **EC-02** | **Translation API (MyMemory) fails** | Every `translateFromEnglish()` / `translateToEnglish()` call wrapped in try/catch. On failure: `console.error`, return English original. In `translateAndDisplay()`, `Promise.all` with per-item `.catch(() => item)` ensures partial failures don't block. User sees English — no crash. |
| **EC-03** | **Chatbot API unreachable** | `sendChatMessage()` throws `{ status: 0, detail: "..." }`. Catch block in `sendToRealChatbot()` / `handleFreeChatReply()`: removes typing indicator, shows error toast, sets `isAnalysing = false`. User can re-click "Diagnose Now" or re-send to retry. |
| **EC-04** | **Emergency API call fails** | `handleEmergencyCall()` catch: `emergencyLoading = false`, red error toast. Button NOT disabled — retry allowed. |
| **EC-05** | **Nominatim reverse-geocode fails** | Reverse-geocode `fetch` wrapped in try/catch. Fallback: `"${userLat}, ${userLng}"`. If lat/lng also null → `"Location unavailable"`. |
| **EC-06** | **Sarvam TTS fails in voice mode** | `speakIfVoiceMode()` already has try/catch → logs error, sets `isSpeaking = false`. Message still displayed as text. **No change needed.** |
| **EC-07** | **`session_complete: true` mid-query** | In `handleChatbotResponse()`: always check `response.session_complete`. If true → `setSessionComplete(true)`, write to localStorage, `setIsFreeChatMode(false)`. "Diagnose Now" button disabled. ChatInput disabled. **"Start New Chat" button rendered** (see Step 3.15). |
| **EC-08** | **`lang === 'en'`** → skip translation | `translateAndDisplay()` checks `lang === 'en'` first — all translation calls skipped. `handleUserSend()` already checks `if (lang !== 'en')` before `translateToEnglish()`. **No change needed.** |
| **EC-09** | **`user_id` from localStorage only** | `patientId` from `getOrCreatePatientId()` reads `localStorage "aetrix_patient_id"`. Never from `state.profile` or `UserContext`. Every `/api/chat` uses this value. |
| **EC-10** | **`action_items` array → translate individually** | `Promise.all(items.map(…))` with per-item `.catch()`. Displayed as numbered list below bot message. Empty array → no list rendered. |

---

## PHASE 7: Testing Checklist

### Pre-requisites

- [ ] FastAPI server running: `http://localhost:8000` (verify `GET /health`)
- [ ] Frontend dev server: `http://localhost:5173`
- [ ] `VITE_SARVAM_API_KEY` set in `FRONTEND/main_frontend/.env`
- [ ] `VITE_CHATBOT_API_URL=http://localhost:8000` in `.env`

### Test Scenarios

| # | Scenario | Steps | Expected Outcome |
|---|----------|-------|-----------------|
| **T-01** | Happy path — English, text mode | Select English → type "headache and fever" → complete QUESTION_FLOW → click "Diagnose Now" | Summary POSTed to `/api/chat`. Response displayed in chat. No translation calls. |
| **T-02** | Happy path — Hindi, text mode | Select Hindi → type symptoms in Hindi → complete flow → "Diagnose Now" | Hindi → English before API. English response → Hindi for display. |
| **T-03** | Happy path — Voice mode | Switch to voice → speak in selected language → answer follow-ups | STT → translate → English in symptomData. Bot questions spoken via TTS. |
| **T-04** | `output_type: query` (multi-turn) | Send symptoms that trigger follow-up | Bot displays translated follow-up. Input re-enabled. User replies freely. Loop until `session_complete`. |
| **T-05** | `output_type: suggestions` | Send mild symptoms | Self-care suggestions + action_items list + disclaimer. Session ends. |
| **T-06** | `output_type: clinic` | Send moderate symptoms + geolocation allowed | Clinic message + action_items + HospitalCarousel with real data. |
| **T-07** | `output_type: emergency` | Send severe/critical symptoms | EmergencyBanner appears. Hospital list. "Call Ambulance" / "Send SMS" buttons visible. |
| **T-08** | Emergency call — success | Click "Call Ambulance" in emergency | Loading → POST → green success → button disabled. |
| **T-09** | Emergency call — failure | Block emergency API → click "Call Ambulance" | Red error toast. Button stays clickable for retry. |
| **T-10** | Geolocation denied | Deny prompt → clinic/emergency flow | No crash. No HospitalCarousel. Emergency uses "Location unavailable". |
| **T-11** | Chatbot API down | Stop FastAPI → click "Diagnose Now" | Typing indicator removed. Error toast. User can retry. |
| **T-12** | Translation failure | Break MyMemory URL → send Hindi message | English displayed. No crash. Console error. |
| **T-13** | TTS failure | Invalidate Sarvam key → voice mode | Console error. Text displays normally. `isSpeaking` resets. |
| **T-14** | Session persistence | Complete session → close tab → reopen | New `session_id` generated. Fresh conversation. |
| **T-15** | Session resume (refresh) | Start QUESTION_FLOW → refresh page | `session_id` preserved. Local state lost (messages restart). Backend retains session context. |
| **T-16** | Patient ID persistence | Open chatbot → check localStorage → close → reopen | Same UUID across visits. |
| **T-17** | CORS verification | DevTools Network tab → send request | No CORS errors. `Access-Control-Allow-Origin` header present. |

---

## COMPLETE DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER INTERACTION                                 │
│                                                                             │
│   Text Mode                          Voice Mode                             │
│   ─────────                          ──────────                             │
│   User types message                 User speaks                            │
│        │                                  │                                 │
│        ▼                                  ▼                                 │
│   [original text]               Sarvam STT → transcript                    │
│        │                           (in user's language)                     │
│        │                                  │                                 │
│        ▼                                  ▼                                 │
│   Display in chat               Display originalText in chat               │
│   as user bubble                as user bubble                              │
│        │                                  │                                 │
│        ▼                                  ▼                                 │
│   ┌──────────────────────────────────────────┐                              │
│   │  lang !== 'en' ?                         │                              │
│   │  YES → translateToEnglish(text)          │                              │
│   │  NO  → pass through                     │                              │
│   └─────────────────┬────────────────────────┘                              │
│                     │                                                       │
│                     ▼                                                       │
│        englishText stored in symptomDataRef                                 │
└─────────────────────┬───────────────────────────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   QUESTION_FLOW        │
         │   (5 questions)        │
         │   severity             │
         │   additional_symptoms  │
         │   duration             │
         │   age_risk             │
         │   comorbidity          │
         └───────────┬────────────┘
                     │ all answered → "Diagnose Now" clicked
                     ▼
         ┌────────────────────────┐
         │  buildSummaryMessage() │
         │                        │
         │  Reads symptomDataRef  │
         │  + state.profile       │
         │                        │
         │  Returns:              │
         │  "Patient symptoms:    │
         │   Severity: ...        │
         │   Duration: ...        │
         │   Age: ...             │
         │   Gender: ...          │
         │   Comorbidities: ..."  │
         └───────────┬────────────┘
                     │
                     ▼
         ┌────────────────────────────────────────────────────┐
         │  sendChatMessage()                                  │
         │                                                     │
         │  POST http://localhost:8000/api/chat                │
         │  {                                                  │
         │    user_id:    patientId (from localStorage),       │
         │    session_id: sessionId (from localStorage),       │
         │    message:    summaryMessage (English),            │
         │    lat:        userLat (from geolocation | null),   │
         │    lng:        userLng (from geolocation | null)    │
         │  }                                                  │
         └───────────────────────┬────────────────────────────┘
                                 │
                                 ▼
         ┌───────────────────────────────────────────────────────────────┐
         │                    FASTAPI BACKEND                            │
         │                                                               │
         │  POST /api/chat → run_chatbot(request)                       │
         │                                                               │
         │  LangGraph Workflow:                                          │
         │    input_node → emergency_node → qna_node →                  │
         │    classification_node → hospital_finding_node → output_node │
         │                                                               │
         │  Returns OutputResponse                                       │
         └───────────────────────┬───────────────────────────────────────┘
                                 │
                                 ▼
         ┌───────────────────────────────────────┐
         │  handleChatbotResponse(response)       │
         │                                        │
         │  Switch on response.output_type:       │
         └───┬────────┬────────┬────────┬────┬────┘
             │        │        │        │    │
             ▼        ▼        ▼        ▼    ▼
          "query"  "answer" "suggest" "clinic" "emergency"
             │        │     "ions"      │        │
             │        │        │        │        │
             ▼        ▼        ▼        ▼        ▼
         ┌──────────────────────────────────────────────────────┐
         │              translateAndDisplay(response)            │
         │                                                      │
         │  1. Translate message    → user's language            │
         │  2. Translate action_items[] → each individually     │
         │  3. Translate disclaimer → user's language            │
         │  4. Build display text (message + items + disclaimer)│
         │  5. addBotMessage(displayText)                       │
         │  6. speakIfVoiceMode(translatedMessage)              │
         └──────────────────────────────────────────────────────┘
             │                          │              │
             ▼                          ▼              ▼
     ┌───────────────┐    ┌─────────────────┐  ┌──────────────────┐
     │ "query" only: │    │ "clinic" /      │  │ "emergency"      │
     │ Enable free-  │    │ "emergency":    │  │ only:            │
     │ form chat.    │    │ normalizeHosp() │  │ setShowEmergency │
     │ User replies  │    │ → HospitalCarou │  │ → EmergencyBanner│
     │ loop back to  │    │   sel rendered  │  │ + action buttons │
     │ sendChatMsg() │    └─────────────────┘  │ handleEmergency  │
     └───────────────┘                         │   Call()         │
                                               └──────────────────┘
```

### Emergency Call Sub-Flow

```
handleEmergencyCall()
  │
  ├─ Reverse geocode (Nominatim)
  │   lat/lng → "123 MG Road, Ahmedabad, Gujarat"
  │   (fallback: "22.3072, 73.1812" or "Location unavailable")
  │
  ├─ Build name from UserContext
  │   state.profile.preferredName → "Sahil"
  │   (fallback: "Unknown Patient")
  │
  ├─ POST https://muddy-wynn-codeshunt-c2861863.koyeb.app/call/emergency
  │   { "name": "Sahil", "location": "123 MG Road, Ahmedabad" }
  │
  ├─ 2xx → Green success indicator, disable button
  └─ Error → Red error toast, button stays enabled for retry
```

### Session Lifecycle

```
First Visit
  │
  ├─ getOrCreatePatientId() → crypto.randomUUID() → localStorage "aetrix_patient_id"
  ├─ New session_id → crypto.randomUUID() → localStorage "aetrix_session_id"
  │
  ▼
Chat in Progress
  │
  ├─ Each /api/chat response → persist response.session_id to localStorage
  │
  ▼
Session Complete (session_complete: true)
  │
  ├─ localStorage.setItem("aetrix_session_complete", "true")
  │
  ▼
User Revisits Chatbot
  │
  ├─ Reads "aetrix_session_complete" === "true"
  ├─ Generates NEW session_id
  ├─ Clears "aetrix_session_complete"
  └─ patientId stays the same (persistent identity)
```

---

## FILES CHANGED — SUMMARY

| Action | File Path | Description |
|--------|-----------|-------------|
| **MODIFY** | `FRONTEND/chatbot/.env` | Add `http://localhost:5173` to `CORS_ORIGINS` if not present |
| **ADD** | `FRONTEND/main_frontend/.env` | Add `VITE_CHATBOT_API_URL=http://localhost:8000` |
| **MODIFY** | `FRONTEND/main_frontend/src/i18n/en.json` | Add 6 new i18n keys (see Phase 0.3) |
| **MODIFY** | `FRONTEND/main_frontend/src/i18n/hi.json` | Add 6 new i18n keys (translated) |
| **MODIFY** | `FRONTEND/main_frontend/src/i18n/gu.json` | Add 6 new i18n keys (translated) |
| **MODIFY** | `FRONTEND/main_frontend/src/i18n/mr.json` | Add 6 new i18n keys (translated) |
| **MODIFY** | `FRONTEND/main_frontend/src/i18n/ta.json` | Add 6 new i18n keys (translated) |
| **CREATE** | `FRONTEND/main_frontend/src/utils/patientId.js` | `getOrCreatePatientId()` — UUID in localStorage |
| **REPLACE** | `FRONTEND/main_frontend/src/utils/chatbotService.js` | Mock → real `sendChatMessage()` with fetch |
| **MODIFY** | `FRONTEND/main_frontend/src/pages/patient/ChatBot.jsx` | Integration wiring — 15 sub-steps (see Phase 3) |

## FILES NOT MODIFIED (constraints)

| File | Reason |
|------|--------|
| `utils/voiceUtils.js` | All Sarvam functions already correct |
| `utils/haversine.js` | Distance util — untouched |
| `contexts/UserContext.jsx` | User state — untouched |
| `contexts/I18nContext.jsx` | Translation context — untouched |
| `components/EmergencyBanner.jsx` | Component untouched — only props/usage changed |
| `components/HospitalCarousel.jsx` | Component untouched — only props/usage changed |
| `components/ChatMessage.jsx` | Component untouched |
| `components/ChatInput.jsx` | Component untouched |

---

## QUESTIONS / ASSUMPTIONS

1. **`EMERGENCY_KEYWORDS` stays in use.** The existing `checkEmergencyKeywords()` uses `EMERGENCY_KEYWORDS` from `mockData.js` for client-side emergency detection (instant `EmergencyBanner` before API responds). The backend independently detects emergencies server-side.

2. **`HospitalCard` prop shape mismatch handled by normalization.** Backend returns `{ distance_km: float, open_now: bool|null }`. Frontend expects `{ distance: string, hours: string }`. `normalizeHospitals()` in `ChatBot.jsx` adapts the shape without modifying `HospitalCard.jsx`.

3. **`handleBookAmbulance` repurposed.** The old PDF report generation via `generateReport()` is dropped. Replaced by `handleEmergencyCall()` which calls the real emergency API.

4. **"Diagnose Now" button remains.** Shows after ≥1 question answered. Now triggers `sendToRealChatbot()` instead of `handleDiagnose()`. Text/appearance unchanged.

5. **Page refresh during conversation.** Local React state (messages, flow progress) is lost on refresh. Backend session persists via `session_id`. User restarts question flow but backend retains prior context. Acceptable trade-off unless chat history persistence in localStorage is required.

6. **No WebSocket/SSE streaming.** Standard request-response (POST → await JSON) pattern. Backend does not stream.

7. **Env var for chatbot URL.** Plan uses `VITE_CHATBOT_API_URL`. If team prefers hardcoding, use `"http://localhost:8000"` directly.

## RESOLVED (no action needed)

- ~~**`firstName` / `lastName` on `state.profile`.**~~ → **Resolved:** `UserContext` has no `firstName`/`lastName` fields. `handleEmergencyCall()` uses only `state.profile.preferredName` with fallback to `"Unknown Patient"`.

- ~~**New i18n keys may be needed.**~~ → **Resolved:** Moved to Phase 0.3 as a required pre-flight step. Six keys must be added to all locale files before implementation.

- ~~**Single emergency API for both ambulance + SMS.**~~ → **Confirmed and closed.** Both "Call Ambulance" and "Send SMS" buttons call the same `handleEmergencyCall()` with identical payload. The backend endpoint handles both ambulance dispatch and SMS notification in a single call. No distinct per-button UX feedback is needed.
