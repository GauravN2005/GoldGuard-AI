FROM python:3.12-slim

WORKDIR /workspace

# Install system utilities needed for building packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependencies list
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source tree
COPY . .

# Expose ports
EXPOSE 8000

# Set start script
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
