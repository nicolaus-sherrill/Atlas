import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Loaded only on /admin, so visitors never download the moderation code
const AdminPage = lazy(() => import("./pages/AdminPage"));

const path = window.location.pathname.replace(/\/+$/, "");
const isAdminRoute = path === `${import.meta.env.BASE_URL.replace(/\/+$/, "")}/admin`;

createRoot(document.getElementById("root")!).render(
  isAdminRoute ? (
    <Suspense fallback={null}>
      <AdminPage />
    </Suspense>
  ) : (
    <App />
  ),
);
