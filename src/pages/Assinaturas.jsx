 import { useMemo, useState,useEffect } from "react";
  
import { hojeLocal, hojeMaisDias } from "../utils/dataLocal";
import { buildWebhookUrl } from "../config/globals";


export default function Assinaturas() {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("TODOS");
  const [forma, setForma] = useState("TODOS");
  const [empresa, setEmpresa] = useState("TODAS");
  const [empresas, setEmpresas] = useState([]);
  const [assinaturas, setAssinaturas] = useState([]);

  const [inicio, setInicio] = useState(hojeMaisDias(-1));
  const [fim, setFim] = useState(hojeLocal());
 

    function formatarDataBR(data) {
  if (!data) return "";
  const d = new Date(data);
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const ano = d.getUTCFullYear();
  return `${dia}-${mes}-${ano}`;
}

  const filtradas = useMemo(() => {
  return assinaturas
    .filter(a =>
      !busca ||
      a.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      a.cpf?.includes(busca)
    )
    .filter(a => status === "TODOS" || a.status === status)
    .filter(a => forma === "TODOS" || a.forma === forma)
    .filter(a => empresa === "TODAS" || String(a.empresa_id) === empresa);
}, [assinaturas, busca, status, forma, empresa]);

 
useEffect(() => {
  async function carregar() {
    try {
      const r = await fetch(buildWebhookUrl("consulta_empresas"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });

      const j = await r.json();
      console.log("🔍 RESPOSTA DO WEBHOOK:", j);

      let lista = [];

      if (Array.isArray(j)) lista = j;
      else if (Array.isArray(j.data)) lista = j.data;
      else if (Array.isArray(j.empresas)) lista = j.empresas;

      setEmpresas(lista);

      // ⚠️ SETA AUTOMATICAMENTE A PRIMEIRA EMPRESA
      if (lista.length > 0 && lista[0].id) {
        setEmpresa(String(lista[0].id));
      }
    } catch (err) {
      console.error("❌ Erro ao carregar empresas:", err);
      setEmpresas([]);
    }
  }

  carregar();
}, []);


useEffect(() => {
  async function carregarAssinaturas() {
    try {
      const r = await fetch(buildWebhookUrl("consulta_assinaturas"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresa !== "TODAS" ? Number(empresa) : null, 
          status: status !== "TODOS" ? status : null,
          forma: forma !== "TODOS" ? forma : null,
           data_inicio: inicio,
          data_fim: fim,
        }),
      });

      const j = await r.json();
      console.log("📦 ASSINATURAS:", j);

      let lista = [];

      if (Array.isArray(j)) lista = j;
      else if (Array.isArray(j.data)) lista = j.data;
      else if (Array.isArray(j.assinaturas)) lista = j.assinaturas;

      setAssinaturas(lista);
    } catch (err) {
      console.error("❌ Erro ao carregar assinaturas:", err);
      setAssinaturas([]);
    }
  }

  carregarAssinaturas();
}, [empresa, inicio, fim, status, forma]);







  return (
    <div>
      {/* CARD FILTROS */}
      <div style={card}>
        <h2>Assinaturas</h2>

        <div style={linha}>
          <input
            placeholder="Buscar por nome ou CPF"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={input}
          />

          <select value={status} onChange={e => setStatus(e.target.value)} style={input}>
            <option value="TODOS">Status</option>
            <option value="Ativa">Ativa</option>
            <option value="Pendente">Pendente</option>
            <option value="Inadimplente">Inadimplente</option>
            <option value="Cancelada">Cancelada</option>
          </select>

          <select value={forma} onChange={e => setForma(e.target.value)} style={input}>
            <option value="TODOS">Forma Pgto</option>
            <option value="PIX">PIX</option>
            <option value="CARTAO">Cartão</option>
          </select>

            <select
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              style={{ padding: 8, fontSize: 14 }}
            >
              <option value="TODAS">Todas as empresas</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nome}
                </option>
              ))}
            </select>




          <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} style={input} />
          <input type="date" value={fim} onChange={e => setFim(e.target.value)} style={input} />
        </div>
      </div>
      {/* TABELA */}
     <table style={table}>
  <thead style={{ background: "#0F172A", color: "#fff" }}>
    <tr>
      <th style={{ padding: 12, textAlign: "center", width: 80 }}>ID</th>
      <th style={{ padding: 12, textAlign: "left" }}>Empresa</th>
      <th style={{ padding: 12, textAlign: "center", width: 140 }}>Plano</th>
       <th style={{ padding: 12, textAlign: "right", width: 140 }}>Valor Mensal</th>
      <th style={{ padding: 12, textAlign: "center", width: 140 }}>Status</th>
      <th style={{ padding: 12, textAlign: "center", width: 140 }}>Forma</th>
      <th style={{ padding: 12, textAlign: "center", width: 160 }}>
        Próx. Cobrança
      </th>
    </tr>
  </thead>

  <tbody>
    {filtradas.map((a, i) => (
      <tr
        key={a.id}
        style={{
          background: i % 2 ? "#E9EDF2" : "#fff",
          borderBottom: "1px solid #d0d7e2",
        }}
      >
        <td style={{ padding: 12, textAlign: "center", fontWeight: "bold" }}>{a.id}</td>
        <td style={{ padding: 12, textAlign: "left", fontWeight: "bold" }}>{a.empresa || "-"}</td>
        <td style={{ padding: 12, textAlign: "center", fontWeight: "bold" }}>{a.plano}</td>
        <td style={{ padding: 12, textAlign: "right", fontWeight: "bold" }}>{a.valor_mensal}</td>
        <td style={{ padding: 12, textAlign: "center" ,  fontWeight: "bold" }}>{a.status}</td>
        <td style={{ padding: 12, textAlign: "center"  , fontWeight: "bold"}}>{a.forma || "-"}</td>
        <td style={{ padding: 12, textAlign: "center", fontWeight: "bold"  }}>
          {formatarDataBR(a.data_fim) || "-"}
        </td>
      </tr>
    ))}
  </tbody>
</table>


    </div>
  );
}

/* ====== ESTILO PADRÃO ====== */
const card = {
  background: "#415A77",
  padding: 16,
  borderRadius: 8,
  color: "#fff",
};

const linha = {
  display: "flex",
  gap: 18,
  marginTop: 12,
  flexWrap: "wrap",
};

const input = {
  padding: 8,
  borderRadius: 4,
  border: "none",
};

const table = {
  width: "100%",
  marginTop: 16,
  borderCollapse: "collapse",
};

const thead = {
  background: "#0B3C7D",
  color: "#fff",
};

/* ====== MOCK ======  
const mock = [
  {
    id: 1,
    nome: "João Silva",
    cpf: "123.456.789-00",
    empresa: "Minha Empresa",
    plano: "PRO",
    status: "Ativa",
    forma: "PIX",
    proxima: "01/03/2026",
  },
  {
    id: 2,
    nome: "Maria Souza",
    cpf: "987.654.321-00",
    empresa: "Empresa X",
    plano: "BÁSICO",
    status: "Inadimplente",
    forma: "CARTAO",
    proxima: "15/02/2026",
  },
];
*/