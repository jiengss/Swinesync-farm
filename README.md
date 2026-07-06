# SwineSync

SwineSync is a comprehensive, offline-first swine management application built with React. It helps farm managers and staff track inventory, monitor health, manage breeding, record feeding schedules, and maintain financial records.

## Features

- **Dashboard**: A high-level overview of farm metrics, including feed stock, active pigs, and health alerts.
- **Inventory Management**: Track all pigs, their statuses, pens, and locations.
- **Health Tracking**: Monitor treatments, vaccinations, illnesses, and overall swine health.
- **Breeding Management**: Keep records of breeding cycles, farrowing, and weaning.
- **Feeding Management**: Manage feed inventory, feed consumption, and schedules.
- **Financial Tracking**: Monitor expenses, revenue, and overall profitability.
- **User Management**: Role-based access control for farm staff and managers.
- **Offline Capabilities**: Fully functional without an internet connection. Data is stored locally and synchronized automatically when connectivity is restored.
- **Notifications**: Real-time alerts and system notifications.

## Technologies Used

- **Frontend**: [React](https://react.dev/), [Vite](https://vitejs.dev/)
- **Backend & Authentication**: [Supabase](https://supabase.com/)
- **Offline Storage**: [Dexie.js](https://dexie.org/) (IndexedDB wrapper)
- **Service Workers & PWA**: [Workbox](https://developer.chrome.com/docs/workbox)
- **Charts & Data Visualization**: [Chart.js](https://www.chartjs.org/) & [react-chartjs-2](https://react-chartjs-2.js.org/)
- **Alerts**: [SweetAlert2](https://sweetalert2.github.io/)

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository and navigate into the project directory (if not already there):
   ```bash
   cd SwineSync-main
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables:
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5173`.

## Offline Functionality

SwineSync is built as a Progressive Web App (PWA) with strong offline capabilities. 
- Using **Workbox Background Sync**, changes made while offline are queued and sent to the server automatically when the network connection is re-established.
- Local data caching is handled via **Dexie.js**, ensuring that you can view and edit records seamlessly without an internet connection.
