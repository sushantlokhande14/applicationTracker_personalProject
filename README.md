# Application Tracker

A clean, private-by-default job application tracker that runs entirely in your browser.

## Features

- Track wishlist, applied, assessment, interview, offer, rejected, and withdrawn stages
- Capture company, role, location, job URL, recruiter, compensation, notes, and next steps
- Monitor follow-up dates and overdue deadlines
- Search, filter, sort, and switch between list and board views
- View pipeline metrics and response rate
- Import and export CSV backups
- Light and dark themes
- Responsive design for desktop and mobile
- No account, server, database, analytics, or tracking

## Run locally

You can open `index.html` directly, or serve the folder locally:

```bash
python3 -m http.server 8080
```

Then visit <http://localhost:8080>.

## Data and privacy

Applications are stored in the browser's `localStorage` under the current origin. They never leave the browser unless you export a CSV yourself.

Because browser storage can be cleared, use **More → Export CSV** periodically to keep a backup. Importing the exported CSV restores the application fields.

## Project structure

```text
.
├── index.html   # Application structure and form
├── styles.css   # Responsive visual design
├── app.js       # Tracker behavior and local persistence
└── README.md
```

