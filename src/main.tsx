import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "@/App";
import { ConfirmProvider } from "@/components/ConfirmProvider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { isNative } from "@/lib/native";
import "@fontsource-variable/inter/opsz.css";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");
if (isNative) document.documentElement.classList.add("native");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ConfirmProvider>
          <App />
          <Toaster
            position="top-center"
            offset={{ top: "max(16px, env(safe-area-inset-top))" }}
          />
        </ConfirmProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
