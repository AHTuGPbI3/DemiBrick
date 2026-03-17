# DemiBrick — LEGO Mosaic Generator

> "The master builder deconstructs reality into bricks"

## Quick Start

### Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API runs at http://localhost:8000
Health check: `POST http://localhost:8000/api/health`

### Frontend (Next.js 14)

```bash
cd frontend
npm install
npm run dev
```

App runs at http://localhost:3000

## Structure

```
DemiBrick/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app + CORS
│   │   ├── api/routes.py    # API endpoints
│   │   ├── services/        # Business logic (Phase 1+)
│   │   └── models/          # Pydantic models (Phase 1+)
│   └── requirements.txt
└── frontend/
    ├── app/
    │   ├── layout.tsx        # Root layout + Navbar
    │   ├── page.tsx          # Home / Hero
    │   ├── create/page.tsx   # Upload & mosaic creator
    │   └── gallery/page.tsx  # Community gallery (stub)
    ├── components/
    │   └── Navbar.tsx
    └── package.json
```

## Phases

- **Phase 0** ✅ — Project skeleton (this)
- **Phase 1** — Photo upload + background removal
- **Phase 2** — Pixelization + LEGO color mapping
- **Phase 3** — Brick optimizer + BOM
- **Phase 4** — Depth map → 2.5D relief
- **Phase 5** — 3D preview (Three.js)
- **Phase 6** — PDF instructions + STL export
- **Phase 7** — UI polish
- **Phase 8** — Deploy (Vercel + Railway)
