# Markdown Notes App

A clean, intuitive, self-hosted web application for organizing and editing Markdown notes in a nested, tree-like folder hierarchy. 

Built with a **FastAPI** backend, a **PostgreSQL** database, and a vanilla **JavaScript** frontend served via **Nginx**. The system is fully containerized and easy to deploy with Podman or Docker.

---

## Features

- **Infinite Nested Folders**: Organize your notes into folders and subfolders with no nesting limits.
- **Rich Markdown Support**: Live preview rendering alongside a full-screen or split-pane editor (using `marked.js`).
- **Drag & Drop Organization**: Easily drag notes inside the sidebar and drop them directly into folders, or drag them outside folders to move them to the root.
- **Fast Navigation & Management**: Create, rename, move, and delete folders or notes directly from the responsive hover actions in the sidebar.
- **DD-MM-YYYY HH:MM European Standard**: Consistent, clear date formatting throughout the user interface.
- **Secure Authentication**: Built-in user authentication backed by a secure `.htpasswd` file.
- **Auto-Save**: Automatic draft saving while typing, with visual status updates.

---

## Tech Stack

- **Frontend**: Vanilla JavaScript, Tailwind CSS (for modern UI), Lucide Icons, Marked.js (Markdown parsing).
- **Backend**: Python 3.12, FastAPI, SQLAlchemy, Pydantic, UV for dependency management.
- **Database**: PostgreSQL 16.
- **Authentication**: `htpasswd` file verification with JWT bearer tokens.
- **Infrastructure**: Podman/Docker, Nginx.

---

## Getting Started

### Prerequisites

Make sure you have the following installed on your machine:
- [Podman](https://podman.io/) (or Docker)
- [Just](https://github.com/casey/just) (command runner)

---

### Running in Development

We provide a convenient `Justfile` to spin up individual components during development.

1. **Deploy the Database**:
   ```bash
   just db
   ```
   *Deploys PostgreSQL on port `5433`.*

2. **Build and Deploy the Backend**:
   ```bash
   just backend
   ```
   *Starts the FastAPI server on port `8001`.*

3. **Build and Deploy the Frontend**:
   ```bash
   just frontend
   ```
   *Deploys the static client via Nginx on port `8081`.*

### Useful Dev Commands

- **Check status of containers**:
  ```bash
  just status
  ```
- **Tail logs**:
  ```bash
  just logs backend     # Or: just logs db, just logs frontend
  ```
- **Stop all components**:
  ```bash
  just stop
  ```
- **Clean up everything** (containers and shared network):
  ```bash
  just down
  ```

---

## Folder Structure

```text
.
├── auth/
│   └── .htpasswd           # User credentials (username:hashed-password)
├── backend/
│   ├── app/                # FastAPI application
│   │   ├── routers/        # Folder and Note API endpoints
│   │   ├── database.py     # SQLAlchemy configuration
│   │   ├── models.py       # Database models (self-referential Folder tree)
│   │   └── main.py         # Entry point
│   ├── Dockerfile
│   └── pyproject.toml      # UV dependency configuration
├── frontend/
│   ├── index.html          # Main SPA interface
│   ├── app.js              # SPA Application Logic (Drag-and-Drop, Rendering)
│   ├── nginx.conf          # Nginx reverse proxy routing
│   └── Dockerfile
├── systemd/                # Podman podlet configurations for production hosting
├── Justfile                # Dev orchestrator
└── docker-compose.yml      # Multi-container orchestration
```

---

## Authentication Configuration

User authentication is performed against an Apache-style `.htpasswd` file located at `auth/.htpasswd`. 

To add or manage users, you can use the `htpasswd` utility:
```bash
# Create or append a user
htpasswd auth/.htpasswd username
```
The FastAPI backend reads this file dynamically to authorize users and issue secure JWT tokens.
