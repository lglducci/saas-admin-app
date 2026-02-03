// src/routes.jsx
import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Assinaturas from "./pages/Assinaturas";
import Cobrancas from "./pages/Cobrancas";
import Faturamento from "./pages/Faturamento";

export default function AppRoutes() {
  return (
    <Routes>
      
<Route path="/dashboard" element={<Dashboard />} />
      <Route path="/assinaturas" element={<Assinaturas />} />
      <Route path="/cobrancas" element={<Cobrancas />} />
      <Route path="/faturamento" element={<Faturamento />} />
    </Routes>
  );
}

 
