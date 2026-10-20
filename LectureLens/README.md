# 🎓 LectureLens — AI-Powered Multimodal Lecture Platform

**LectureLens** is a next-generation AI-powered multimodal lecture and learning platform. It allows instructors to conduct live university lectures with real-time WebRTC audio/video communication, screen sharing, and interactive live chat, while multimodal AI captures, analyzes, and synthesizes speech, whiteboard notes, and slides into structured academic knowledge.

---

## 🌟 Key Capabilities & Features

### 1. WebRTC Live Media & Screen Sharing (mediasoup SFU)
- **Multi-party Audio & Video**: Low-latency mediasoup Selective Forwarding Unit (SFU) architecture.
- **Dedicated Screen Sharing**: Instructors can share their entire screen, application window, or browser tab (`navigator.mediaDevices.getDisplayMedia`).
- **Dedicated Large View**: Students automatically receive the shared screen in a dedicated, high-resolution primary stage, with participant camera feeds organized in a tidy strip.
- **Connection Quality Monitoring**: Continuous WebRTC stats monitoring exposing connection status (*Excellent*, *Good*, *Fair*, *Poor*).

### 2. Real-Time Speech-to-Text & Speaker Identification
- **Audio Chunking Pipeline**: MediaRecorder captures audio chunks and streams them to the STT service.
- **Speaker Tagging**: Automatically attributes spoken segments to the instructor or student (*e.g., `00:02:31 Teacher: ...` or `00:15:42 Student: ...`*).
- **Multi-Language Subtitles**: Instant live translation into Spanish, Hindi, Marathi, French, and German.
- **Pluggable Backends**: Google Gemini Flash Audio STT (with automatic key rotation), Faster-Whisper local offline engine, and OpenAI Whisper.

### 3. Board & Screen Multimodal Vision Understanding
- **Whiteboard Extraction**: Periodic frame sampling or manual snapshot transforms handwritten/printed notes into clean text, equations into **KaTeX / LaTeX** format, and visual drawings into architectural diagram descriptions.
- **Slide Understanding**: Detects slide transitions, extracting slide titles, bullet points, source code snippets, and diagrams.
- **Unified Knowledge Representation**: Synchronizes spoken words, whiteboard equations, and slide concepts into chronological multimodal lecture events.

### 4. Post-Lecture Learning Hub & Review Suite
- **🎥 Video Recording & Range Streaming**: Full lecture session captured via MediaRecorder API and stored locally for instant video playback with HTTP range scrubbing.
- **🔍 Searchable Transcript**: Instant full-text search across all spoken segments; clicking any search result jumps playback to that exact timestamp.
- **🧠 AI Executive Summary**: Generates concise executive bullet points, detailed topic-by-topic explanations, key concepts, academic definitions, practical examples, and essential takeaways.
- **📝 Structured Study Notes**: 4 customizable study modes:
  1. *Short Notes* (High-yield cheat-sheet)
  2. *Detailed Notes* (Exhaustive academic textbook style)
  3. *Exam-Oriented Notes* (Marking schemes, probable questions, and formulas)
  4. *Beginner-Friendly Notes* (Intuitive breakdowns and analogies)
- **💬 "Ask This Lecture" (RAG Q&A)**: Strict lecture-grounded Retrieval-Augmented Generation. Prioritizes information from this specific lecture, rejects hallucinations, and cites exact lecture timestamps (*Source: Lecture timestamp 05:24*).
- **📑 Automatic Chapters**: AI segments the lecture timeline into logical chapters with summaries; clicking any chapter navigates directly to that timestamp.
- **🎯 AI Quiz Generation & Assessment**: Generates MCQ, True/False, Fill-in-the-blank, and Short-answer questions. Students take the quiz interactively, receive instant scores, correct answers, detailed pedagogical explanations, and a diagnosis of weak topics.
- **🗂️ AI Flashcards**: Interactive digital flashcards for spaced-repetition revision, with *Mark Learned* and *Mark Difficult* progress tracking.
- **📄 Downloadable PDFs**: Professional, publication-ready PDF exports:
  - Complete Timestamped Transcript PDF
  - AI Executive Summary PDF
  - Complete Structured Study Notes PDF (with formulas, diagrams, and review questions)

### 5. Security & Persistent Database
- **Role-Based Access Control (RBAC)**: `TEACHER`, `STUDENT`, `ADMIN` with protected REST API routes and Socket.IO handshakes.
- **Password Hashing & JWT**: BCrypt password hashing and signed JSON Web Tokens.
- **Persistent Relational Database**: SQLite relational storage with complete foreign keys, indices, and schema for Users, Lectures, Transcripts, Segments, Board Content, Screen Content, Summaries, Notes, Quizzes, Flashcards, and Recordings.

---

## 🏗️ Architecture & Tech Stack

```text
┌────────────────────────────────────────────────────────┐
│                   React 18 + Vite Frontend             │
│  Tailwind CSS • WebRTC API • mediasoup-client • Axios  │
└───────────────────────────┬────────────────────────────┘
                            │
               ┌────────────┴────────────┐
               │                         │
               ▼                         ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  mediasoup SFU + Node Server │  │  FastAPI Python AI Service   │
│  Express • Socket.IO • DB    │  │  Faster-Whisper • Vision OCR │
│  JWT • PDFKit • SQLite       │  │  Port: 8000                  │
│  Port: 3001                  │  └──────────────────────────────┘
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  Spring Boot 3.x Backend     │  │      Google Gemini API       │
│  Java 21 • Spring Security   │  │  gemini-flash-latest         │
│  Spring Data JPA • PDFBox    │  │  Multimodal Vision & LLM     │
│  Port: 8080                  │  └──────────────────────────────┘
└──────────────────────────────┘
```

---

## 🚀 Getting Started

### 1. Default Demo Credentials

The persistent database is automatically seeded with three pre-configured accounts:

| Role | Email | Password |
|---|---|---|
| **Teacher** | `teacher@lecturelens.edu` | `password123` |
| **Student** | `student@lecturelens.edu` | `password123` |
| **Admin** | `admin@lecturelens.edu` | `admin123` |

*(You can also use the one-click demo login buttons directly on the Login page).*

---

### 2. Running the Application

#### A. Node.js Media SFU & API Server
```powershell
cd server
npm start
```
*Server runs on `http://localhost:3001`.*

#### B. Speech-to-Text Server (Gemini or Whisper)
```powershell
cd server
npm run stt-gemini
```
*STT service listens on `http://localhost:5000`.*

#### C. React Client
```powershell
cd client
npm run dev
```
*Access the web app at `http://localhost:5173`.*

#### D. Python FastAPI AI Service (Optional / Modular)
```powershell
cd server
npm run ai-service
```
*FastAPI docs available at `http://localhost:8000/docs`.*

#### E. Spring Boot 3.x Backend (Java 21)
```powershell
cd spring_backend
mvn clean spring-boot:run
```
*Spring Boot runs on `http://localhost:8080`.*

---

## 📂 Project Directory Structure

```text
LectureLens/
├── client/                     # React 18 + Vite frontend
│   ├── src/
│   │   ├── hooks/
│   │   │   ├── useMediasoup.js # WebRTC, mediasoup, Screen Share, Quality
│   │   │   └── useTranscript.js# STT chunking, Recording, Board capture
│   │   ├── pages/
│   │   │   ├── Home.jsx        # Landing page
│   │   │   ├── Login.jsx       # Auth sign-in & demo logins
│   │   │   ├── Register.jsx    # Registration
│   │   │   ├── Dashboard.jsx   # Lecture catalog & host controls
│   │   │   ├── RoomPage.jsx    # Live lecture room & dedicated screen share
│   │   │   └── PostLectureHub.jsx # 7-tab review suite & PDF exports
│   │   ├── services/
│   │   │   └── api.js          # Centralized Axios API client
│   │   ├── socket.js           # Socket.IO client instance
│   │   └── App.jsx             # React Router with protected routes
│   └── package.json
│
├── server/                     # Node.js + mediasoup SFU server
│   ├── src/
│   │   ├── server.js           # Express REST API & Socket.IO signaling
│   │   ├── db.js               # SQLite database, indices, seed data
│   │   ├── auth.js             # JWT, BCrypt, Role-Based Access Control
│   │   ├── Room.js             # mediasoup Room, screen sharing, peers
│   │   ├── visionService.js    # Whiteboard & screen Gemini Vision AI
│   │   ├── summaryService.js   # Multimodal synthesis, 4-mode notes, chapters
│   │   ├── ragService.js       # "Ask This Lecture" RAG Q&A with citations
│   │   ├── quizService.js      # AI Quiz generation, grading, flashcards
│   │   ├── pdfService.js       # PDFKit document generator (3 PDF types)
│   │   └── recordingService.js # Local video storage & range streaming
│   └── package.json
│
├── ai_service/                 # Python FastAPI AI microservice
│   └── main.py                 # Faster-Whisper, Board OCR, Screen OCR
│
└── spring_backend/             # Java 21 Spring Boot 3.x backend
    ├── src/main/java/com/lecturelens/
    │   ├── model/              # User, Lecture, Transcript, Quiz, etc.
    │   ├── repository/         # Spring Data JPA repositories
    │   ├── security/           # Spring Security, JWT filter, BCrypt
    │   ├── service/            # Apache PDFBox note export service
    │   └── controller/         # AuthController, LectureController
    └── pom.xml
```

---

## 🧪 Verified Test Flows

1. **Authentication**: Register new user, login with JWT token, role-based protection.
2. **Lecture Management**: Host creates lecture, enters room, shares 8-digit room code.
3. **Screen Sharing**: Instructor shares display/window, students view in dedicated high-res stage.
4. **Live Chat**: Real-time Socket.IO chat with user names and roles.
5. **Speech-to-Text**: MediaRecorder chunks audio, STT transcribes in real-time with speaker tags.
6. **Vision AI**: Whiteboard snaps convert formulas into LaTeX equations and diagram descriptions.
7. **Lecture Recording**: MediaRecorder captures video stream, uploads upon lecture conclusion, and streams back with HTTP Range support.
8. **RAG Q&A**: Question asked against lecture transcripts returns grounded answers with exact timestamp citations.
9. **Interactive Quiz**: AI generates 4 question types, scores student submissions, and highlights weak topics.
10. **PDF Exports**: Generates and downloads Transcript PDF, Summary PDF, and Complete Study Notes PDF.
