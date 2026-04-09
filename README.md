# DataSphere HANA Explorer

A modern, full-stack web application for connecting to **SAP DataSphere** or **SAP HANA Cloud** — featuring an intuitive interface for data exploration, visualization, and AI-powered SQL querying.

---

## Features

| Feature | Description |
|---------|-------------|
| **Interactive Dashboard** | Operational insights: table/view counts, largest tables by row count, storage utilization, active connections |
| **AI SQL Assistant** | Convert natural language to SAP HANA SQL via **OpenRouter** (StepFun Step 3.5 Flash) — free tier available |
| **Data Explorer** | Browse schemas, search tables/views, preview first 100 rows instantly |
| **Excel Export** | Download full table data (up to 10,000 rows) as formatted Excel files |
| **Dark Mode** | Full light/dark theme support |
| **Secure Connections** | Native TLS encryption enforced on all HANA Cloud/DataSphere connections |

---

## Tech Stack

**Frontend:** React 18, Vite, Tailwind CSS, Zustand, Recharts, Lucide Icons

**Backend:** Node.js, Express.js, `@sap/hana-client`, `exceljs`, `openai` SDK (OpenRouter compatible)

---

## Getting Started

### Prerequisites

- Node.js v18+
- npm v9+
- OpenRouter API Key *(optional, for AI features)* — [get one free](https://openrouter.ai/keys)

### Installation

```bash
git clone https://github.com/oktaydoganyildiz/datasphere-explorer.git
cd datasphere-explorer
npm run setup
```

`npm run setup` installs dependencies for root, server, and client automatically.

### Running

```bash
npm start
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

---

## Configuration

```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your SAP HANA connection details and (optionally) your OpenRouter API key.

---

## Security

- Database passwords and API keys are **never stored or logged** — processed in memory only
- All HANA Cloud/DataSphere connections use `encrypt: true` by default

---

## License

MIT — see [LICENSE](./LICENSE) for details.
