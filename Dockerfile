# ── Stage 1: Frontend build ───────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# ── Stage 2: Backend build ────────────────────────────────────────────────────
FROM eclipse-temurin:17-jdk AS backend-build

WORKDIR /app

COPY gradlew gradlew
COPY gradle/ gradle/
RUN chmod +x gradlew && ./gradlew --version

COPY build.gradle settings.gradle* ./
RUN ./gradlew dependencies --no-daemon -q || true

COPY src/ src/

COPY --from=frontend-build /app/src/main/resources/static/ src/main/resources/static/

RUN ./gradlew bootJar --no-daemon -x test


# ── Stage 3: Runtime ──────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=backend-build /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java -Dserver.port=${PORT:-8080} -jar app.jar --spring.profiles.active=prod"]