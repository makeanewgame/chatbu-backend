FROM node:22

ARG DATABASE_URL

# PostgreSQL client'ı yükle
RUN apt-get update && \
    apt-get install -y postgresql-client && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install global & local deps first
RUN npm install pm2 -g

# Clean install to avoid any potential issues
RUN npm ci --force || npm install --force

# Install Prisma and related dependencies v7
RUN npm install prisma @types/node @types/pg --save-dev 
RUN npm install @prisma/client @prisma/adapter-pg pg dotenv

# Prisma client MUST be generated after installing ALL deps including Prisma CLI
# Use a dummy DATABASE_URL for build (will be overridden at runtime)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

# Verify Prisma installation
RUN npx prisma --version

# Copy the rest of the application
COPY . .

# Copy entrypoint from the build context
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["/entrypoint.sh"]