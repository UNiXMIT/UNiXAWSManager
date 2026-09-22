# syntax=docker/dockerfile:1

# Stage 1: Build the React frontend
FROM node:26-alpine AS frontend-builder

WORKDIR /build/client
COPY client/package.json ./
RUN --mount=type=cache,target=/root/.npm npm install --registry=https://registry.npmjs.org/
COPY client/ ./
RUN npm run build

# Stage 2: Production server
FROM node:26-alpine AS production

WORKDIR /app

# Copy server code
COPY server/package.json ./
RUN --mount=type=cache,target=/root/.npm npm install --omit=dev --registry=https://registry.npmjs.org/
COPY server/ ./

# Copy built frontend into server/public
COPY --from=frontend-builder /build/client/dist ./public

EXPOSE 3001

CMD ["node", "server.js"]