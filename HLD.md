# High-Level Design: AI Technical Interviewer Platform

## 1. System Overview

The AI Technical Interviewer is a full-stack Next.js application that conducts realistic technical interviews using AI. It supports multiple interview modes (text, voice, coding), provides real-time feedback, and generates comprehensive evaluations.

### Core Capabilities
- **Multi-modal interviews**: Text, voice, coding, or combined modes
- **Real-time AI interaction**: Streaming responses with natural conversation flow
- **Code analysis**: Live code evaluation with complexity analysis
- **Voice pipeline**: Speech-to-text, AI processing, and text-to-speech in real-time
- **Comprehensive evaluation**: Detailed scoring across multiple dimensions

---

## 2. Architecture Overview

### 2.1 Technology Stack

**Frontend**
- Next.js 16 (App Router)
- React 19
- TypeScript
- TailwindCSS
- Monaco Editor (code editing)
- WebSocket (real-time voice communication)

**Backend**
- Next.js API Routes
- Node.js custom server (WebSocket support)
- NextAuth.js (authentication)
- Prisma ORM (database access)

**External Services**
- **Database**: PostgreSQL (via Neon serverless)
- **Cache/Session**: Upstash Redis
- **LLM**: Groq (Llama 3.3 70B)
- **Speech-to-Text**: HuggingFace Whisper Large v3 Turbo
- **Text-to-Speech**: Kokoro-82M (HuggingFace Spaces)
- **Auth**: Google OAuth

### 2.2 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  Browser                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Setup Wizard │  │ Chat UI      │  │ Code Editor  │         │
│  │              │  │ + Voice      │  │ (Monaco)     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│         │                  │                  │                 │
│         └──────────────────┴──────────────────┘                 │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                    HTTP / WebSocket
                             │
┌────────────────────────────┼─────────────────────────────────────┐
│                    APPLICATION LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  Next.js Server (Node.js)                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  API Routes                                              │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ /start   │ │ /message │ │ /evaluate│ │ /run-code│  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  WebSocket Server (Voice Pipeline)                      │   │
│  │  /api/voice/ws                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Business Logic                                          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐               │   │
│  │  │ Groq LLM │ │ Whisper  │ │ TTS      │               │   │
│  │  │ Client   │ │ Client   │ │ Client   │               │   │
│  │  └──────────┘ └──────────┘ └──────────┘               │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────────┐
│                      DATA LAYER                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐              ┌──────────────────┐         │
│  │  PostgreSQL      │              │  Redis           │         │
│  │  (Neon)          │              │  (Upstash)       │         │
│  │                  │              │                  │         │
│  │  - Users         │              │  - Session State │         │
│  │  - Sessions      │              │  - Conversation  │         │
│  │  - Turns         │              │  - TTL Cache     │         │
│  │  - Evaluations   │              │                  │         │
│  └──────────────────┘              └──────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────────┐
│                   EXTERNAL SERVICES                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Groq    │  │HuggingFace│ │ Kokoro   │  │  Google  │       │
│  │  API     │  │ Whisper   │ │  TTS     │  │  OAuth   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Components

### 3.1 Frontend Components

#### Setup Wizard (`components/interview/SetupWizard.tsx`)
- **Purpose**: Multi-step configuration for interview parameters
- **Steps**:
  1. Topic selection (DSA, System Design, Backend, Behavioral, Custom)
  2. Custom topic input (if selected)
  3. Difficulty level (Easy, Medium, Hard, FAANG)
  4. Experience level (Beginner, Intermediate, Advanced, FAANG)
  5. Duration (Rapid: 10min/2Q, Standard: 30min/4Q, Full: 60min/6Q)
  6. Mode (Text, Coding, Voice+Text, Voice+Coding)
  7. Confirmation and start
- **Output**: Creates interview session via `/api/interview/start`

#### Chat Interface (`components/interview/ChatInterface.tsx`)
- **Purpose**: Main conversation UI with AI interviewer
- **Features**:
  - Message bubbles (user/AI) with markdown rendering
  - Typing indicators and speaking indicators
  - Streaming text display (WebSocket mode)
  - Audio playback with replay functionality
  - Mute/unmute controls
  - Barge-in support (interrupt AI while speaking)
- **Modes**:
  - **HTTP mode**: Text/Coding - sends messages via POST requests
  - **WebSocket mode**: Voice modes - real-time bidirectional communication
- **State Management**:
  - Message history
  - Loading/speaking states
  - Audio player lifecycle
  - WebSocket connection with auto-reconnect

#### Code Editor (`components/interview/CodeEditor.tsx`)
- **Purpose**: Monaco-based code editor for coding interviews
- **Features**:
  - Multi-language support (JavaScript, TypeScript, Python, Java, C++)
  - Syntax highlighting and IntelliSense
  - "Run & Analyze" button triggers code analysis
  - Collapsible analysis panel showing:
    - Time/space complexity
    - Test results
    - Bugs and suggestions
    - Overall feedback
- **Integration**: Passes current code to ChatInterface for context

#### Voice Recorder (`components/interview/VoiceRecorder.tsx`)
- **Purpose**: Audio capture for voice-enabled interviews
- **Modes**:
  - **HTTP mode**: Record → Stop → Transcribe → Send
  - **WebSocket mode**: Push-to-talk with streaming
- **Features**:
  - MediaRecorder API with Opus codec
  - Visual recording indicator
  - Microphone permission handling
  - Audio chunking (100ms intervals)

### 3.2 Backend API Routes

#### `/api/interview/start` (POST)
- **Purpose**: Initialize new interview session
- **Flow**:
  1. Authenticate user (NextAuth session)
  2. Validate configuration
  3. Create `InterviewSession` in PostgreSQL
  4. Initialize Redis session state with TTL
  5. Generate first AI question via Groq LLM
  6. Store first turn in database
  7. Return `sessionId` and `firstMessage`
- **Response**: `{ sessionId: string, firstMessage: string }`

#### `/api/interview/message` (POST)
- **Purpose**: Handle user responses in text/coding modes
- **Flow**:
  1. Authenticate and validate session ownership
  2. Load session state from Redis
  3. Append user message to conversation history
  4. Include code context if provided (coding mode)
  5. Call Groq LLM with full conversation history
  6. Detect completion signal ("that wraps up our interview")
  7. Update Redis state and PostgreSQL turns
  8. Return AI reply and completion status
- **Request**: `{ sessionId, message, code?, language? }`
- **Response**: `{ reply: string, isComplete: boolean }`

#### `/api/interview/evaluate` (POST)
- **Purpose**: Generate final evaluation after interview completion
- **Flow**:
  1. Load session state (Redis or fallback to DB)
  2. Check for existing evaluation (idempotent)
  3. Call Groq LLM with evaluator system prompt
  4. Parse JSON evaluation (scores, strengths, weaknesses, summary)
  5. Store evaluation in PostgreSQL
  6. Clean up Redis session
  7. Return evaluation
- **Scoring Dimensions**:
  - Problem Solving (0-10)
  - Code Quality (0-10)
  - Time Complexity (0-10)
  - Communication (0-10)
  - Edge Cases (0-10)
  - Overall (0-10)

#### `/api/interview/run-code` (POST)
- **Purpose**: Analyze submitted code during coding interviews
- **Flow**:
  1. Authenticate user
  2. Validate code length (<10k chars)
  3. Call Groq LLM with code analysis prompt
  4. Parse JSON response with complexity, bugs, suggestions, test results
  5. Return analysis
- **Request**: `{ sessionId, code, question }`
- **Response**: `{ analysis: CodeAnalysis }`

#### `/api/voice/transcribe` (POST)
- **Purpose**: Convert audio to text (HTTP mode fallback)
- **Flow**:
  1. Receive audio file (FormData)
  2. Extract buffer and MIME type
  3. Call HuggingFace Whisper API
  4. Filter hallucinations (common false positives)
  5. Return transcript
- **Response**: `{ transcript: string }`

#### `/api/voice/speak` (POST)
- **Purpose**: Generate speech audio (HTTP mode fallback)
- **Flow**:
  1. Receive text (<5000 chars)
  2. Call Kokoro TTS API
  3. Return WAV audio buffer
- **Response**: Binary audio data

### 3.3 WebSocket Voice Pipeline (`lib/voice-pipeline.ts`)

**Purpose**: Real-time voice interview orchestration

**Connection**: `/api/voice/ws?sessionId={id}`

**Message Protocol**:

**Client → Server**:
```json
{ "type": "end_of_speech", "audio": "<base64>", "mimeType": "audio/webm", "code"?: "...", "language"?: "..." }
{ "type": "interrupt" }
{ "type": "ping" }
```

**Server → Client**:
```json
{ "type": "transcript", "text": "..." }
{ "type": "ai_text_chunk", "text": "..." }
{ "type": "audio_chunk", "data": "<base64 MP3>", "sentenceText": "..." }
{ "type": "response_complete", "isComplete": boolean }
{ "type": "error", "message": "..." }
{ "type": "pong" }
```

**Pipeline Flow**:
1. **Audio Reception**: Client sends base64-encoded audio
2. **Transcription**: Whisper STT converts to text
3. **Transcript Broadcast**: Send transcript to client (user bubble appears)
4. **Session Loading**: Fetch state from Redis
5. **Context Enrichment**: Append code context if provided
6. **LLM Streaming**: Stream tokens from Groq LLM
   - Send each token to client (`ai_text_chunk`)
   - Buffer tokens into sentences
7. **TTS Synthesis**: When sentence boundary detected:
   - Synthesize speech via Kokoro TTS
   - Send audio chunk to client
   - Continue with next sentence (pipelined)
8. **Completion Detection**: Check for completion signal
9. **State Persistence**: Update Redis and PostgreSQL
10. **Response Complete**: Notify client

**Key Features**:
- **Streaming**: Text and audio streamed incrementally
- **Sentence-level TTS**: Audio generated per sentence for lower latency
- **Barge-in**: Client can interrupt AI mid-response
- **Abort Handling**: AbortController cancels in-flight operations
- **Keepalive**: Ping/pong every 100s to prevent proxy timeouts
- **Auto-reconnect**: Client retries up to 5 times with exponential backoff

---

## 4. Data Models

### 4.1 PostgreSQL Schema (Prisma)

#### User
```prisma
model User {
  id              String           @id @default(cuid())
  name            String?
  email           String?          @unique
  emailVerified   DateTime?
  image           String?
  experienceLevel ExperienceLevel?
  
  accounts          Account[]
  sessions          Session[]
  interviewSessions InterviewSession[]
}
```

#### InterviewSession
```prisma
model InterviewSession {
  id              String          @id @default(cuid())
  userId          String
  topic           InterviewTopic
  customTopic     String?
  difficulty      Difficulty
  experienceLevel ExperienceLevel
  mode            InterviewMode
  durationType    DurationType
  startedAt       DateTime        @default(now())
  endedAt         DateTime?
  overallScores   Json?
  isComplete      Boolean         @default(false)
  
  user        User            @relation(...)
  turns       InterviewTurn[]
  evaluations Evaluation[]
}
```

#### InterviewTurn
```prisma
model InterviewTurn {
  id         String   @id @default(cuid())
  sessionId  String
  role       TurnRole    // AI | USER
  kind       TurnKind    // QUESTION | ANSWER | FOLLOWUP | SYSTEM
  content    String   @db.Text
  audioUrl   String?
  questionId String?
  createdAt  DateTime @default(now())
  
  session  InterviewSession @relation(...)
  question Question?        @relation(...)
}
```

#### Evaluation
```prisma
model Evaluation {
  id         String   @id @default(cuid())
  sessionId  String
  questionId String?
  scores     Json     // EvaluationScores
  strengths  String   @db.Text
  weaknesses String   @db.Text
  summary    String   @db.Text
  createdAt  DateTime @default(now())
  
  session  InterviewSession @relation(...)
  question Question?        @relation(...)
}
```

### 4.2 Redis Session State

**Key Pattern**: `interview:session:{sessionId}`

**TTL**: 
- RAPID: 15 minutes
- STANDARD: 45 minutes
- FULL: 90 minutes

**Structure**:
```typescript
interface RedisSessionState {
  sessionId: string;
  userId: string;
  topic: InterviewTopic;
  customTopic?: string;
  difficulty: Difficulty;
  experienceLevel: ExperienceLevel;
  mode: InterviewMode;
  durationType: DurationType;
  conversationHistory: ConversationMessage[];  // LLM context
  questionIndex: number;
  followupCount: number;
  isComplete: boolean;
  startedAt: string;
}
```

**Purpose**:
- Fast access to conversation history for LLM calls
- Avoid database round-trips during active interview
- Automatic cleanup via TTL
- Fallback to PostgreSQL if expired

---

## 5. AI Integration

### 5.1 Groq LLM (Llama 3.3 70B)

**Model**: `llama-3.3-70b-versatile`

**Use Cases**:
1. **Interviewer**: Conducts interview, asks questions, provides follow-ups
2. **Evaluator**: Analyzes full transcript and generates scores
3. **Code Analyzer**: Reviews code for correctness, complexity, bugs

#### Interviewer System Prompt
- Configured with interview parameters (topic, difficulty, experience, duration)
- Enforces question pacing (max questions based on duration)
- Provides realistic FAANG-level interviewing behavior
- Asks follow-ups on complexity, edge cases, trade-offs
- **Critical rule**: Never end interview while candidate is coding
- Completion signal: "That wraps up our interview..."

#### Evaluator System Prompt
- Analyzes full conversation transcript
- **Critical scoring rule**: Caps scores based on completion rate
  - 50% completion → max 5/10 on all scores
  - Incomplete interviews = automatic failure
- Returns structured JSON with scores, strengths, weaknesses, summary
- Honest evaluation (no score inflation)

#### Code Analyzer Prompt
- Evaluates code correctness
- Calculates time/space complexity
- Identifies bugs and suggests improvements
- Generates test case results
- Returns structured JSON

### 5.2 Whisper STT (HuggingFace)

**Model**: `openai/whisper-large-v3-turbo`
**Endpoint**: HuggingFace Inference API

**Features**:
- Accepts audio in WebM/Opus or MP4 format
- Returns transcript text
- Hallucination filtering (removes common false positives like "thank you", "bye")
- Handles model loading delays (503 errors)

### 5.3 Kokoro TTS (HuggingFace Spaces)

**Model**: `Kokoro-82M`
**Endpoint**: Custom FastAPI server on HF Spaces

**Features**:
- Multiple voices (Male - Michael is default)
- Accepts up to 5000 characters
- Returns WAV audio
- Streaming support (future enhancement)
- Low latency (~1-2s for typical sentences)

---

## 6. Key Workflows

### 6.1 Interview Start Flow

```
User → Setup Wizard → POST /api/interview/start
                              ↓
                    Create InterviewSession (PostgreSQL)
                              ↓
                    Initialize Redis session state
                              ↓
                    Call Groq LLM (first question)
                              ↓
                    Store first turn (PostgreSQL)
                              ↓
                    Return sessionId + firstMessage
                              ↓
User → Redirected to /interview/[sessionId]
```

### 6.2 Text/Coding Interview Flow

```
User types message → POST /api/interview/message
                              ↓
                    Load session from Redis
                              ↓
                    Append user message + code context
                              ↓
                    Call Groq LLM (full history)
                              ↓
                    Detect completion signal
                              ↓
                    Update Redis + PostgreSQL
                              ↓
                    Return AI reply + isComplete
                              ↓
User sees AI response → (repeat until complete)
```

### 6.3 Voice Interview Flow (WebSocket)

```
User clicks mic → MediaRecorder starts
                              ↓
User clicks stop → Send audio via WebSocket
                              ↓
Server: Whisper transcription
                              ↓
Server: Send transcript to client (user bubble)
                              ↓
Server: Load Redis session
                              ↓
Server: Stream LLM tokens
        ├─→ Send text chunks to client (live display)
        └─→ Buffer into sentences
                              ↓
Server: TTS per sentence
        └─→ Send audio chunks to client
                              ↓
Server: Detect completion
                              ↓
Server: Update Redis + PostgreSQL
                              ↓
Server: Send response_complete
                              ↓
User hears AI response → (repeat until complete)
```

### 6.4 Code Analysis Flow

```
User writes code → Clicks "Run & Analyze"
                              ↓
                    POST /api/interview/run-code
                              ↓
                    Call Groq LLM (code analysis prompt)
                              ↓
                    Parse JSON response
                              ↓
                    Return analysis
                              ↓
User sees complexity, bugs, suggestions, test results
```

### 6.5 Evaluation Flow

```
Interview complete → User clicks "Get Feedback"
                              ↓
                    POST /api/interview/evaluate
                              ↓
                    Load full conversation history
                              ↓
                    Call Groq LLM (evaluator prompt)
                              ↓
                    Parse JSON evaluation
                              ↓
                    Store in PostgreSQL
                              ↓
                    Clean up Redis session
                              ↓
User sees scores, strengths, weaknesses, summary
```

---

## 7. Security & Authentication

### 7.1 Authentication (NextAuth.js)
- **Provider**: Google OAuth
- **Strategy**: JWT-based sessions
- **Session Storage**: HTTP-only cookies
- **Secure Cookies**: Enabled in production

### 7.2 Authorization
- **Session Ownership**: All API routes verify `session.userId === state.userId`
- **Middleware**: Protects `/interview/*` and `/dashboard` routes
- **Database**: User ID foreign keys with cascade delete

### 7.3 Input Validation
- **Code Length**: Max 10,000 characters
- **TTS Text**: Max 5,000 characters
- **Required Fields**: Validated on all API routes
- **Session Expiry**: Redis TTL prevents stale sessions

---

## 8. Performance Optimizations

### 8.1 Caching Strategy
- **Redis**: Hot session data (conversation history)
- **PostgreSQL**: Cold storage (completed sessions, evaluations)
- **TTL**: Automatic cleanup of expired sessions

### 8.2 Streaming
- **LLM**: Token-by-token streaming reduces perceived latency
- **TTS**: Sentence-level synthesis (parallel fetch + playback)
- **WebSocket**: Bidirectional streaming for voice modes

### 8.3 Code Splitting
- **Monaco Editor**: Dynamic import with loading fallback
- **Next.js**: Automatic code splitting per route

### 8.4 Audio Optimization
- **Codec**: Opus (WebM) for efficient compression
- **Chunking**: 100ms intervals for responsive recording
- **Pipelining**: Fetch next TTS chunk while playing current

---

## 9. Error Handling

### 9.1 Client-Side
- **Network Errors**: Retry logic with exponential backoff (WebSocket)
- **Microphone Access**: Graceful degradation with error messages
- **Audio Playback**: Fallback to text-only mode on failure

### 9.2 Server-Side
- **LLM Failures**: Return error message to user
- **Whisper 503**: Inform user model is loading
- **Session Not Found**: Check Redis → PostgreSQL → 404
- **WebSocket Errors**: Abort in-flight operations, log errors

### 9.3 Data Integrity
- **Idempotent Evaluation**: Check for existing evaluation before generating
- **Transaction Safety**: Prisma transactions for multi-table updates
- **Cascade Deletes**: User deletion removes all related data

---

## 10. Scalability Considerations

### 10.1 Current Limitations
- **WebSocket**: Single server instance (no horizontal scaling)
- **TTS**: External service rate limits
- **LLM**: Groq API rate limits

### 10.2 Future Enhancements
- **Load Balancing**: Sticky sessions for WebSocket
- **Redis Pub/Sub**: Distribute WebSocket messages across instances
- **CDN**: Cache static assets and audio files
- **Database Pooling**: Connection pooling for high concurrency
- **Queue System**: Background job processing for evaluations

---

## 11. Monitoring & Observability

### 11.1 Logging
- **Console Logs**: Detailed logging in voice pipeline and API routes
- **Error Tracking**: Catch blocks log errors with context
- **Performance**: Log TTS/STT latency

### 11.2 Metrics (Future)
- **Interview Completion Rate**: % of started interviews completed
- **Average Duration**: Actual vs. expected duration
- **Error Rates**: API failures, WebSocket disconnects
- **LLM Token Usage**: Cost tracking

---

## 12. Deployment Architecture

### 12.1 Current Setup
- **Platform**: Render (or similar Node.js hosting)
- **Database**: Neon (serverless PostgreSQL)
- **Cache**: Upstash (serverless Redis)
- **Custom Server**: `server.ts` with WebSocket support

### 12.2 Environment Variables
```
DATABASE_URL=postgresql://...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
GROQ_API_KEY=...
HUGGINGFACE_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_URL=https://...
NEXTAUTH_SECRET=...
```

### 12.3 Build Process
1. `npm run build` - Next.js production build
2. `prisma generate` - Generate Prisma client
3. `npm start` - Start custom server with WebSocket

---

## 13. Future Enhancements

### 13.1 Features
- **Multi-language Support**: i18n for global users
- **Interview History**: Dashboard with past sessions
- **Practice Mode**: Unlimited retries without evaluation
- **Collaborative Interviews**: Multiple interviewers/observers
- **Video Support**: Screen sharing for system design

### 13.2 Technical Improvements
- **Persistent WebSocket**: Reconnect without losing state
- **Offline Support**: PWA with service workers
- **Real-time Collaboration**: Shared code editor (CRDT)
- **Advanced Analytics**: Heatmaps, time-per-question, etc.
- **A/B Testing**: Experiment with different prompts/models

---

## 14. Summary

The AI Technical Interviewer is a sophisticated platform that combines multiple AI services (LLM, STT, TTS) with real-time communication (WebSocket) to deliver a realistic interview experience. The architecture prioritizes:

- **Low Latency**: Streaming responses, sentence-level TTS, Redis caching
- **Reliability**: Error handling, auto-reconnect, fallback mechanisms
- **Scalability**: Serverless database, stateless API routes, Redis session management
- **User Experience**: Multi-modal interaction, live feedback, comprehensive evaluation

The system successfully orchestrates complex workflows involving audio processing, natural language understanding, code analysis, and real-time communication, all while maintaining a clean separation of concerns and robust error handling.
