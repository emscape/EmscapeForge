# Project Detection Guide

## Detection Patterns

This guide helps identify and categorize projects in the workspace.

### Language & Framework Detection

#### TypeScript / JavaScript
**Markers**: `package.json` with `typescript` or `.ts`/`.js` files
```
dependencies: {
  "react": "...",           → React frontend
  "next": "...",            → Next.js full-stack
  "express": "...",         → Node.js backend
  "@nestjs/core": "...",    → NestJS backend
  "vue": "...",             → Vue.js frontend
}
```
**Deployment**: npm scripts (build, start, test)

#### Python
**Markers**: `requirements.txt`, `pyproject.toml`, `setup.py`, or `.py` files
```
Flask / Django       → Web framework
Pandas / NumPy       → Data processing
FastAPI              → Async API
Pytest               → Testing
```
**Deployment**: `pip`, `poetry`, `conda`

#### Java
**Markers**: `pom.xml` (Maven) or `build.gradle` (Gradle)
```
org.springframework:spring-boot  → Spring Boot
org.apache.kafka:kafka-clients  → Kafka integration
junit                           → Testing
```
**Deployment**: `mvn clean package`, `gradle build`

#### Flutter / Dart
**Markers**: `pubspec.yaml`
```
flutter: ...                → Flutter mobile app
dependencies:
  http: ...                 → HTTP client
  provider: ...             → State management
```
**Deployment**: `flutter build`, `flutter run`

#### Go
**Markers**: `go.mod`, `.go` files
```
Deployment**: `go build`, `go run`

#### Docker / Infrastructure
**Markers**: `Dockerfile`, `docker-compose.yml`, `kubernetes/`, `terraform/`
```
Multi-stage Dockerfile      → Production optimization
docker-compose.yml          → Local development stack
K8s manifests               → Kubernetes deployment
Terraform / Bicep           → Infrastructure as Code
```

### Project Classification

| Type | Indicators | Examples |
|------|-----------|----------|
| **Frontend** | `package.json` with React/Vue/Angular, `src/`, `.html` | webapp, mobile UI |
| **Backend** | Framework (Express, Django, Spring), API routes, database access | API server, microservice |
| **Full-stack** | Both frontend and backend code, usually `/frontend` and `/backend` or `/pages` + `/api` | Next.js app, monorepo |
| **Mobile** | `pubspec.yaml` (Flutter), `ios/android/` directories | Flutter app, native app |
| **Tooling** | CLI, scripts, utilities, no visible frontend/backend | build tools, CLI utilities |
| **Infrastructure** | Docker, K8s, Terraform, CI/CD configs | deployment config, infrastructure |
| **Documentation** | Markdown, `docs/`, README | project guides, team docs |

### Dependency Extraction

#### For Node.js
```json
{
  "dependencies": {
    "package-name": "^version"
  },
  "devDependencies": {...}
}
```
Focus on key dependencies (frameworks, runtimes, data stores, messaging).

#### For Python
```
# requirements.txt
package-name==version
package-name>=version
```

#### For Java
```xml
<!-- pom.xml -->
<dependency>
  <groupId>org.example</groupId>
  <artifactId>package-name</artifactId>
  <version>1.0.0</version>
</dependency>
```

#### For Dart
```yaml
# pubspec.yaml
dependencies:
  package_name: ^version
```

### Deployment Target Detection

| Target | Markers |
|--------|---------|
| **Web (Static)** | `index.html`, `dist/`, CDN config, GitHub Pages |
| **Node.js Server** | `server.js`, `express`, `node start` script |
| **Serverless** | `serverless.yml`, `functions/`, AWS Lambda configs |
| **Container** | `Dockerfile`, `.dockerignore`, container registry reference |
| **Kubernetes** | `k8s/`, `helm/`, `kustomize/` directories |
| **Mobile App** | `pubspec.yaml` (Flutter), Xcode project (iOS), gradle (Android) |
| **Desktop App** | Electron config, `windows/`, `macos/` directories |
| **Database** | Database schema files, migration scripts |

### Version Extraction

**Node.js**: `package.json` → `"@latest"`, `"^18.0.0"`, `"~14.21.3"`
**Python**: `requirements.txt` → `pandas==1.3.5`
**Java**: `pom.xml` → `<version>2.6.1</version>`
**Docker**: `Dockerfile` → `FROM node:18-alpine`

## Common Patterns

### Monorepo
- **Markers**: Root `package.json` with `"workspaces"`, `/packages` directory
- **Detection**: Multiple `package.json` at depth 2+

### Microservices
- **Markers**: `/services` directory with separate `package.json` per service
- **Detection**: Multiple deployable projects with clear service boundaries

### Feature Branches
- **Markers**: Git branch contains `/`, WIP in commit history
- **Detection**: Check `.git/HEAD` for current branch

## Analysis Tips

1. **Ignore build artifacts**: `/node_modules`, `/dist`, `/build`, `/target`
2. **Focus on config files**: Package managers always define dependencies clearly
3. **Check timestamps**: `git log --format=%ai` to find active vs. abandoned projects
4. **Look for README**: Project purpose and setup instructions
5. **Scan CI/CD**: `.github/workflows/`, `.gitlab-ci.yml` reveal deployment patterns
