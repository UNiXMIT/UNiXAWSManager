# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /build/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine AS production

WORKDIR /app

# Copy server code
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ ./

# Copy built frontend into server/public
COPY --from=frontend-builder /build/client/dist ./public

EXPOSE 3001

CMD ["node", "server.js"]
