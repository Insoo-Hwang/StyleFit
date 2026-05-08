# ── Stage 1: Frontend build ───────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# vite.config.js outDir = '../src/main/resources/static'
# → output lands at /app/src/main/resources/static
RUN npm run build


# ── Stage 2: Backend build ────────────────────────────────────────────────────
FROM eclipse-temurin:17-jdk-alpine AS backend-build

WORKDIR /app

# Gradle wrapper & dependency cache layer
COPY gradlew gradlew
COPY gradle/ gradle/
RUN chmod +x gradlew && ./gradlew --version

# Dependencies only (cache until build files change)
COPY build.gradle settings.gradle* ./
RUN ./gradlew dependencies --no-daemon -q || true

# Copy source
COPY src/ src/

# Copy frontend build output into the correct Spring Boot static location
COPY --from=frontend-build /app/src/main/resources/static/ src/main/resources/static/

RUN ./gradlew bootJar --no-daemon -x test


# ── Stage 3: Runtime ──────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

COPY --from=backend-build /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar", "--spring.profiles.active=prod"]
