# Justfile for Markdown Notes Application (Local Development)

# Default command lists all available commands
default:
    @just --list

# Prepare the shared container network
prepare-network:
    @podman network inspect notes-net >/dev/null 2>&1 || podman network create notes-net

# Deploy the PostgreSQL database instance
db: prepare-network
    @echo "=== Deploying Database ==="
    @podman rm -f notes-db >/dev/null 2>&1 || true
    @podman run -d \
        --name notes-db \
        --network notes-net \
        -p 5433:5432 \
        -e POSTGRES_USER=notes \
        -e POSTGRES_PASSWORD=notes \
        -e POSTGRES_DB=notes \
        -v notes-db-data:/var/lib/postgresql/data \
        docker.io/library/postgres:16-alpine
    @echo "Database deployed and started successfully. Port: 5433"

# Build and deploy the FastAPI backend container
backend: prepare-network
    @echo "=== Building and Deploying Backend ==="
    @podman build -t localhost/notes-backend:latest ./backend
    @podman rm -f notes-backend >/dev/null 2>&1 || true
    @podman run -d \
        --name notes-backend \
        --network notes-net \
        -p 8001:8000 \
        -e PYTHONUNBUFFERED=1 \
        -e DATABASE_URL=postgresql://notes:notes@notes-db:5432/notes \
        -e HTPASSWD_PATH=/etc/notes/htpasswd \
        -e JWT_SECRET=super-secret-notes-key-change-in-production-12345! \
        -v $(pwd)/auth/.htpasswd:/etc/notes/htpasswd:ro,z \
        localhost/notes-backend:latest
    @echo "Backend built and deployed successfully. Port: 8001"

# Build and deploy the Nginx frontend container
frontend: prepare-network
    @echo "=== Building and Deploying Frontend ==="
    @podman build -t localhost/notes-frontend:latest ./frontend
    @podman rm -f notes-frontend >/dev/null 2>&1 || true
    @podman run -d \
        --name notes-frontend \
        --network notes-net \
        -p 8081:80 \
        localhost/notes-frontend:latest
    @echo "Frontend built and deployed successfully. Port: 8081"

# Check the status of all application containers
status:
    @echo "=== Active Containers ==="
    @podman ps --filter name=notes-

# Tail the logs for a specific container (db, backend, frontend)
logs container:
    @podman logs -f notes-{{container}}

# Stop all application containers
stop:
    @echo "=== Stopping Containers ==="
    @podman stop notes-frontend notes-backend notes-db >/dev/null 2>&1 || true

# Stop and remove all application containers and networks
down:
    @echo "=== Cleaning Up Containers and Network ==="
    @podman rm -f notes-frontend notes-backend notes-db >/dev/null 2>&1 || true
    @podman network rm notes-net >/dev/null 2>&1 || true
    @echo "Cleaned up all development containers and networks."
