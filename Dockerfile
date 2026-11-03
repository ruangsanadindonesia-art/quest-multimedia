FROM node:22-alpine AS frontend
WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY frontend/ frontend/
COPY vite.config.js ./
RUN npm run build

FROM golang:1.26-alpine AS backend
RUN apk add --no-cache gcc musl-dev sqlite-static
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /build/dist ./dist
RUN CGO_ENABLED=1 go build -trimpath -ldflags="-s -w -extldflags '-static' -X main.Version=$(git describe --tags --always --dirty 2>/dev/null || echo dev) -X main.Commit=$(git rev-parse --short HEAD 2>/dev/null || echo none)" -o laju-go ./cmd/laju-go

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata sqlite
WORKDIR /app
COPY --from=backend /build/laju-go .
COPY --from=backend /build/migrations ./migrations
COPY --from=backend /build/dist ./dist
COPY --from=backend /build/public ./public
EXPOSE 8080
CMD ["./laju-go"]
