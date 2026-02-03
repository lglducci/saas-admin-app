 
import { Routes, Route } from "react-router-dom";
import Sidebar from "./layout/Sidebar";
import Dashboard from "./pages/Dashboard";
import Assinaturas from "./pages/Assinaturas";
import Cobrancas from "./pages/Cobrancas";
import Pagamentos from "./pages/Pagamentos";

export default function App() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      <main style={{ padding: 24, flex: 1 }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/assinaturas" element={<Assinaturas />} />
          <Route path="/cobrancas" element={<Cobrancas />} />
          <Route path="/pagamentos" element={<Pagamentos />} />
        </Routes>
      </main>
    </div>
  );
}
