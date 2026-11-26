# Hybrid Lab (Next.js + FastAPI + SQLite)

## Backend
    cd backend
    python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000
API docs: http://localhost:8000/docs  (the SQLite file hybrid_lab.db is created automatically)

## Frontend (second terminal)
    cd frontend
    npm install
    npm run dev
Open http://localhost:3000

All values are illustrative educational estimates, not hardware benchmarks.
Calibrate PARADIGMS and TASKS in backend/models.py with real measurements for realistic results.

## UI notes
Theme: jet black, royal amethyst (#8b5cf6), electric cyan (#22e5ff), with orchid and mint as supporting accents.
Presentation mode: press `P` (or the Present button) for fullscreen with larger type. Keys `1`-`4` switch tabs.
