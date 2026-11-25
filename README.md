# 📱 API Evolution Integrated Chatwoot — WhatsApp Connection Panel

A **multi-page** front-end built with **plain HTML, CSS, and JavaScript** (no framework, no build step), where each company logs in, checks the status of its **Evolution API** WhatsApp instance (integrated with **Chatwoot**), and **connects or disconnects** it through an automatically renewed **QR Code** — all orchestrated by **n8n** flows.

🔗 **Backend/orchestration:** n8n webhooks at `n8n.m2k.app.br` (login, dashboard, connect, disconnect, and register flows)

🌐 **Access the page published here:** [https://link-generico.com](https://link-generico.com)

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [QR Code Connection and Renewal Flow](#qr-code-connection-and-renewal-flow)
- [API Integration (n8n)](#api-integration-n8n)
- [Interface](#interface)
- [Local Development](#local-development)
- [Deployment](#deployment)
- [License](#license)

---

## Project Overview

**API Evolution Integrated Chatwoot** is a lean front-end whose responsibility is to let each user manage the WhatsApp connection of the Evolution API instance linked to their company in Chatwoot. The app has three pages (login, dashboard, and user registration) and no local backend — authentication, instance data, and QR Code generation all come from n8n webhooks:

- Login with email and password, with inline validation of required fields and temporary error messages
- Session handled through a token returned by the login webhook and stored in `localStorage`, sent as a `Bearer` token on every authenticated request
- Dashboard showing the instance name and its connection status (**Conectado** / **Desconectado**), loaded on page open
- Single action button that switches between **Conectar** and **Desconectar** depending on the current status
- Display of the QR Code returned by the API, accepting either a **JSON response with a base64-encoded image** or a **binary (blob) response**
- A 25-second countdown timer that checks the connection and automatically renews the QR Code, up to a limit of attempts
- Registration page for creating new users, shown only to instances whose name contains `M2K`
- Automatic session cleanup and redirect to the login page when the token is expired or rejected (`401`/`403`)

---

## Tech Stack

| Layer            | Technology                                                 |
| ---------------- | ---------------------------------------------------------- |
| Language         | JavaScript (native ES, no transpilation)                   |
| Markup/Styling   | Pure HTML5 + CSS3 (no framework/utilities)                 |
| Icons            | Font Awesome (via CDN kit)                                 |
| Orchestration    | n8n Webhooks (`n8n.m2k.app.br`)                            |
| Session          | Token stored in `localStorage` (`Bearer` authorization)    |
| HTTP Client      | Native `fetch` (JSON and `blob`)                           |
| Hosting          | Static files (HTML/CSS/JS) — no Node process in production |

---

## Project Structure

```
API-Evolution-Integrated-Chatwoot/
├── index.html                  ← login page (entry point)
├── pages/
│   ├── dashboard.html          ← instance status, QR Code, and connect/disconnect button
│   └── register.html           ← new user registration form
└── src/
    ├── js/
    │   └── script.js           ← all logic: login, register, dashboard, QR Code
    │                              generation/renewal, timer, disconnect, logout
    ├── style/
    │   └── main.css            ← styles shared by all pages (dark layout, loader, status badges)
    └── img/
        └── logo_thumbnail_circle.svg   ← favicon
```

---

## Architecture

The project is deliberately simple: the three pages share a single `script.js`, and the functions that run depend on which elements exist in the current page (for example, `loadingUser()` runs only on `dashboard.html`).

| Layer                     | Responsibility                                                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication**        | `login` and `register` validate the fields, call the n8n webhooks, and store/send the token; the logout icon clears `token` and `connection` from `localStorage`                |
| **Dashboard**             | `loadingUser` and `updateDashboard` fetch and render the instance name and status, update the action button, and handle `401`/`403` responses by ending the session             |
| **Connection Cycle**      | `toggleConnection`, `fetchAndDisplayQRCode`, `startQrTimer`, `updateTimer`, `handleTimerExpired`, and `stopQrProcess` implement the flow of generation → waiting → renewal → confirmation/expiration |

There are no modules, bundler, or third-party dependencies beyond loading Font Awesome via `<script>` in each page. State lives in global variables (`timeLeft`, `qrAttempts`, timer IDs) and in `localStorage` (`token` and `connection`).

---

## QR Code Connection and Renewal Flow

- **Status on load:** when the dashboard opens, `GET dashboard` returns the instance name and connection state, and the button is set to **Conectar** or **Desconectar**.
- **QR Code request:** clicking **Conectar** calls `GET connect`. If the instance is already `open`, the status is updated and no QR Code is shown.
- **Image response:** the response is inspected by `content-type` — if it's `application/json`, the QR Code comes as base64 (`qrCodeBase64`, `base64`, or `qrcode`); otherwise, it's treated as a binary `blob` and converted into an Object URL.
- **25s countdown:** after displaying the QR Code, a countdown timer (`updateTimer`) starts and triggers `handleTimerExpired` when it reaches zero.
- **Status check:** `handleTimerExpired` queries the `dashboard` webhook again; if the connection is now `open`, the flow ends with a success message.
- **Automatic renewal:** if not yet connected, a new QR Code is requested and the cycle restarts, for a maximum of **3 QR Codes** (the initial one plus 2 renewals).
- **Expiration:** once attempts are exhausted, the process stops and the user is asked to click **Conectar** again.
- **Disconnect:** when the instance is `open`, the button calls `GET disconnect` and the dashboard is updated with the returned status.
- **Expired session:** a `401` or `403` removes the token and redirects to the login page (`https://evo.m2k.app.br`) after 2 seconds.

---

## API Integration (n8n)

This front-end has no server-side logic of its own — all orchestration happens through n8n webhooks, called directly from the browser:

| Webhook      | Method | Auth   | Usage                                                                       |
| ------------ | :----: | :----: | --------------------------------------------------------------------------- |
| `login`      |  POST  |   —    | Validates email and password and returns the session `token`                |
| `dashboard`  |  GET   | Bearer | Returns the instance name and connection state (`open` or not)              |
| `connect`    |  GET   | Bearer | Returns the QR Code (base64 JSON or image blob) or `connection: "open"`     |
| `disconnect` |  GET   | Bearer | Disconnects the instance and returns the updated state                      |
| `register`   |  POST  | Bearer | Creates a new user from the submitted email and password                    |

Calls with a body use `Content-Type: application/json`, except for reading the QR Code image, which may come as a `blob` depending on the response type.

> ⚠️ The check that shows the register icon only for instance names containing `M2K` is a UI convenience. Permission to create users must be enforced inside the n8n `register` flow.

---

## Interface

The application is made of three screens with visual states controlled by `hidden` attributes:

| Element           | Behavior                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Login form        | Email and password fields; submits on button click or the `Enter` key                                         |
| Dashboard header  | Instance name and a status badge (green for connected, red for disconnected)                                  |
| Action button     | Toggles between **Conectar** and **Desconectar** according to the current status                              |
| Loader            | Spinner shown during requests to the webhooks                                                                 |
| QR Code           | Image displayed as soon as it's returned by the API, hidden between renewals and once connected               |
| Timer             | 25-second countdown until the next verification/renewal                                                       |
| Register form     | Email and password for a new user, with a back icon to the dashboard                                          |
| Icons             | Register (visible for `M2K` instances), back, and logout, which ends the session                              |
| Notes             | Validation messages, errors, or status messages, which automatically disappear after 4s                       |

Interface texts are in Brazilian Portuguese (`pt-BR`).

---

## Local Development

There's no build process, dependencies, or environment variables — just serve the static files:

```bash
# 1. Clone the repository and enter the project folder
git clone <this-repository-url>
cd API-Evolution-Integrated-Chatwoot

# 2. Serve the files with any static server
npx serve .
# or, with the VS Code Live Server extension, open index.html
```

> ℹ️ The webhook URLs (`loginRoutes`, `dashboardRoutes`, `connectRoutes`, `disconnectRoutes`, `registerRoutes`) and the login redirect (`urlHome`) are hardcoded in `src/js/script.js`, pointing to the production environment. To test against a different environment, adjust these constants before serving the project. The n8n webhooks must also allow requests from the origin you are serving from (CORS).

---

## Deployment

Since this is a purely static bundle (`index.html`, `pages/`, `src/js`, `src/style`, `src/img`), deployment consists of publishing these files to any static hosting service:

- **Build:** none — the files are ready to use as-is.
- **Upload:** publish `index.html`, `pages/`, and `src/` to the hosting root, keeping the folder structure (pages use relative paths such as `../src/`).
- **Login redirect:** `urlHome` in `script.js` must point to the URL where `index.html` is published, since it is where users are sent when the session expires.
- No route rewriting is needed (`.htaccess`), since navigation uses plain links between the HTML files.

---

## License

This project is developed and maintained by [M2K Soluções](https://kelvesmoura.com).