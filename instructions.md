# note taking app

## GOAL
The goal is to build a tool to manage notes

## Requirements
* tree structure / folder: users must be able to organize their notes in folders: no limit to the ammount of subfolders
* notes are markdown file and should support the markdown syntax

### Technical Requirements
This application will be composed of 3 components:
* Backend: written in python as a fast api application, use UV for dependency management
* DB: let's use postgres
* Frontend: Feel free to use whichever stack fits the requirements the most
* auth: let's use htpasswd file

The application will be hosted with podman podlet.
During development I need a justfile with 3 commands:
* backend: build and deploy the backend container
* db: deploy a postgres instance
* frontend: build and deploy the frontend container

These commands will alllow me to deploy components individually during development.

### UX/UI
The UX/UI of the application should be very simple and intuitive.
The locale is Europe, so use the DD-MM-YYYY HH:MM standard.


# Revisions:
## 1
folder can be nested like in a tree structure
