 import { Routes, Route } from "react-router-dom";
import Sidebar from "./layout/Sidebar";
import Dashboard from "./pages/Dashboard";
import Assinaturas from "./pages/Assinaturas";
import Cobrancas from "./pages/Cobrancas";
import Pagamentos from "./pages/Pagamentos";
import ModelosTemp from "./pages/ModelosTemp";
import CategoriaModelos from "./pages/CategoriaModelos";
import ControlaTrial from "./pages/ControlaTrial";
import ProspectFlow from "./pages/ProspectFlow";

export default function App() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      <main
        style={{
          flex: 1,
          minWidth: 0,
          overflowX: "hidden",
          padding: 24,
        }}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/assinaturas" element={<Assinaturas />} />
          <Route path="/cobrancas" element={<Cobrancas />} />
          <Route path="/pagamentos" element={<Pagamentos />} />
          <Route path="/modelos" element={<ModelosTemp />} />
          <Route path="/categoria-modelo" element={<CategoriaModelos />} />
          <Route path="/controla-trial" element={<ControlaTrial />} />
          <Route path="/prospectflow" element={<ProspectFlow />} />
        </Routes>
      </main>
    </div>
  );
}
