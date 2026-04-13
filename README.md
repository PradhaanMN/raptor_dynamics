# Raptor Dynamics Website

Official website for Raptor Dynamics, The National Institute of Engineering, Mysuru.

## Repository Structure

```text
.
|-- index.html
|-- admin.html
|-- server.js
|-- package.json
|-- .env.example
|-- assets/
|   |-- css/
|   |   |-- style.css
|   |   `-- admin.css
|   |-- js/
|   |   |-- script.js
|   |   `-- admin.js
|   `-- images/
|       |-- drone.png
|       |-- Drone_club_logo.jpeg
|       |-- hero_bg.png
|       |-- hero_drone.png
|       |-- logo.jpeg
|       |-- logo_clean.png
|       |-- logo_dark.png
|       |-- logo_mark_clean.png
|       |-- nie-logo.svg
|       `-- tech_bg.png
|-- docs/
|   |-- Raptor Dynamics.pdf
|   `-- reference/
|       `-- _ref_home.html
|-- data/
|   `-- cms.json
|-- uploads/
|   |-- team/
|   `-- events/
|-- .gitignore
`-- README.md
```

## Frontend Only (Static)

From the repository root:

```powershell
python -m http.server 5500
```

Open: http://localhost:5500

## Admin Backend (Login + Photo/Event Updates)

Install dependencies:

```powershell
npm install
```

Create environment file:

```powershell
copy .env.example .env
```

Update credentials in `.env`:

```text
ADMIN_USERNAME=your_admin_user
ADMIN_PASSWORD=your_secure_password
SESSION_SECRET=long_random_secret_here
PORT=3000
```

Start backend server:

```powershell
npm start
```

Open URLs:

- Website (served by backend): http://localhost:3000
- Admin panel: http://localhost:3000/admin

### What Admin Can Update

- Advisor/member photos (mapped to existing team cards)
- Events list (title, type, date, description)
- Event photos

Uploaded files are saved under `uploads/team/` and `uploads/events/`.

## Deployment Note

GitHub Pages is static-only, so the admin backend and uploads will not run there.
Deploy `server.js` on a Node-capable host (for example Render, Railway, Fly.io, VPS) to use login, uploads, and live updates.

## Notes

- `index.html` is the entry point.
- Styles are in `assets/css/style.css`.
- Scripts are in `assets/js/script.js`.
- All media assets are in `assets/images/`.
