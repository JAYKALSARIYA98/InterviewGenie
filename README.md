# AI Interview Platform

This repository contains:

- `fe` (React + Vite frontend)
- `question-generation-backend` (Node.js + Express + MongoDB)
- `ai-video-backend` (Flask + MediaPipe + Groq transcription/evaluation)

## What You Get

- Added `.env` files and moved Groq API key out of source code.
- Replaced local Whisper/Torch transcription with Groq `whisper-large-v3-turbo`.
- Improved answer-analysis prompt and stricter JSON parsing.
- Upgraded facial analysis (eye contact, stability, engagement, confidence, nervousness).
- Reduced dependencies (removed unused frontend packages, removed local Whisper/Torch/Scipy stack, removed LangChain wrapper).
- Added Dockerfiles and `docker-compose.yml`.
- Improved frontend UX for Home, Dashboard, Interview, and Results pages.

## Environment Files

Do not commit real `.env` files to GitHub. Use the templates and create local `.env` files:

- `ai-video-backend/.env`
- `question-generation-backend/.env`
- `fe/.env`

Templates:

- `ai-video-backend/.env.example`
- `question-generation-backend/.env.example`
- `fe/.env.example`

Update `MONGODB_URI` in `question-generation-backend/.env` with your Atlas connection string (512MB free tier is fine).

Quick start:

```bash
copy question-generation-backend\.env.example question-generation-backend\.env
copy ai-video-backend\.env.example ai-video-backend\.env
copy fe\.env.example fe\.env
```

## Run With Docker (Recommended)

From repo root:

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:5173`
- App API: `http://localhost:3000`
- Video API: `http://localhost:5000`

Stop:

```bash
docker compose down
```

## Run Locally Without Docker

### 1) Question Backend

```bash
cd question-generation-backend
npm install
npm run start
```

### 2) Video Backend

```bash
cd ai-video-backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### 3) Frontend

```bash
cd fe
npm install
npm run dev
```

## Notes

- Ensure `ffmpeg` is available (Dockerfile already installs it).
- If OTP email is not needed, keep SMTP values blank.
- Production: set a strong `JWT_SECRET`.

## GitHub Safety

- Root `.gitignore` ignores all `**/.env` files and build folders like `**/dist`.
- If you already have `.env` files tracked by git, untrack them before pushing (gitignore cannot hide tracked files):

```bash
git rm --cached question-generation-backend/.env ai-video-backend/.env fe/.env
```

## Suggested Free Deployment Stack

For the closest option to "free forever":

- Frontend: Cloudflare Pages (Free plan)
- APIs (Node + Flask): Oracle Cloud Always Free compute VM (run both containers on one VM with Docker Compose)
- Database: MongoDB Atlas M0 free cluster (512 MB)

Alternative: Render/Railway free tiers are good for testing, but they are usage-limited and can suspend/sleep services.
