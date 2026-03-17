FROM python:3.11-slim

WORKDIR /app

# System deps for Pillow, scikit-image, onnxruntime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1-mesa-glx \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download U2Net model at build time so cold starts are fast
# (saves ~176 MB to /root/.cache/demibrick/u2net.onnx)
RUN python -c "\
import urllib.request, pathlib; \
d = pathlib.Path('/root/.cache/demibrick'); d.mkdir(parents=True, exist_ok=True); \
p = d / 'u2net.onnx'; \
print('Downloading U2Net...'); \
urllib.request.urlretrieve('https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx', p); \
print(f'Done: {p.stat().st_size/1e6:.1f} MB') \
"

# Copy source
COPY app/ ./app/

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT:-8000}/health')"

EXPOSE 8000

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
