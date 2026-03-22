# DataSphere HANA Explorer 🚀

A modern, full-stack web application designed to connect to **SAP DataSphere** or **HANA Cloud**, providing an intuitive interface for data exploration, visualization, and AI-powered querying.



---

## 🌟 Key Features

-   **📊 Interactive Dashboard:** Get instant "Operational Insights" into your HANA system, including:
    -   Total Tables & Views count.
    -   Dynamic visualization of Largest Tables by row count.
    -   Storage utilization tracking.
    -   Real-time active connection monitoring.
-   **🤖 AI SQL Assistant:** Convert natural language questions into valid SAP HANA SQL queries using **Google Gemini 1.5 Flash**.
-   **📋 Data Explorer:** Browse schemas, search for tables/views, and preview the first 100 rows of data instantly.
-   **📥 Excel Export:** Download complete table data (limit 10k rows) as professionally formatted Excel files.
-   **🌙 Dark Mode:** Full UI support for both Light and Dark themes.
-   **🔒 Secure Connection:** Native encryption for DataSphere/HANA Cloud connections.

---

## 🏗️ Architecture

-   **Frontend:** React 18, Vite, Tailwind CSS, Zustand (State Management), Recharts (Visualizations), Lucide Icons.
-   **Backend:** Node.js, Express.js, `@sap/hana-client` (Native Driver), `exceljs` (Report Engine), `@google/generative-ai` (Gemini SDK).

---

## 🚀 Getting Started

### Prerequisites

-   **Node.js** (v18 or higher)
-   **npm** (v9 or higher)
-   **Google Gemini API Key** (Optional, for AI features. Get one at [Google AI Studio](https://aistudio.google.com/))

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/datasphere-explorer.git
    cd datasphere-explorer
    ```

2.  **Run the Setup Script:**
    This command installs dependencies for the root, server, and client directories automatically.
    ```bash
    npm run setup
    ```

### Running the Application

Start both the backend and frontend concurrently:

```bash
npm start
```

-   **Frontend:** [http://localhost:5173](http://localhost:5173)
-   **Backend API:** [http://localhost:3000](http://localhost:3000)

---

## 🛠️ Configuration

Copy the example environment file in the `server` directory and fill in your details (optional):

```bash
cp server/.env.example server/.env
```

---

## 🛡️ Security & Privacy

-   **Credentials:** Database passwords and API keys are processed in real-time and are **never stored** on the server or logged.
-   **Native Encryption:** All connections to HANA Cloud/DataSphere are enforced with `encrypt: true`.

---

## 📝 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---


