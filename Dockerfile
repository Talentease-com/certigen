FROM node:20-slim

# Install Sharp dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install ALL dependencies (need drizzle-kit at runtime for migrations)
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Create data directories
RUN mkdir -p data/templates data/certificates

# Make entrypoint executable
RUN chmod +x entrypoint.sh

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

ENTRYPOINT ["./entrypoint.sh"]
