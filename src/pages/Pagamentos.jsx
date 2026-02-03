 import { useEffect, useState } from "react";
import { buildWebhookUrl } from "../config/globals";
import { hojeLocal, hojeMaisDias } from "../utils/dataLocal";


function formatarDataBR(d) {
  if (!d) return "-";
  return d.slice(0, 10).split("-").reverse().join("/");
}

export default function Pagamentos() {
  const [lista, setLista] = useState([]);
  const [status, setStatus] = useState("TODOS");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState(hojeLocal());
  const [loading, setLoading] = useState(false);

const [empresa, setEmpresa] = useState("TODAS");
  const [empresas, setEmpresas] = useState([]);

  async function carregar() {
    setLoading(true);
    try {
      const r = await fetch(buildWebhookUrl("pagamentos"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           empresa_id: empresa !== "TODAS" ? Number(empresa) : null, 
          status: status === "TODOS" ? "" : status, 
            meio_pagamento: "", 
          data_pagamento: fim || "",
        }),
      });

      const j = await r.json();

      if (Array.isArray(j)) setLista(j);
      else if (Array.isArray(j?.data)) setLista(j.data);
      else setLista([]);
    } catch (e) {
      console.error("Erro ao carregar pagamentos", e);
      setLista([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [status, inicio, fim]);

  // 🔢 TOTAL
  const totalValor = lista.reduce((acc, p) => {
    const v = Number(String(p.valor_pago).replace(",", "."));
    return acc + (isNaN(v) ? 0 : v);
  }, 0);
 
 
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

  return (
    <div>
      {/* CARD FILTROS */}
      <div style={card}>
        <h2>Pagamentos</h2>

        <div style={linha}>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={input}
          >
            <option value="TODOS">Status</option>
            <option value="approved">Aprovado</option>
            <option value="pending">Pendente</option>
            <option value="rejected">Rejeitado</option>
          </select>

          {/*  <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            style={input}
          />*/}

          <input
            type="date"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            style={input}
          />

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

        </div>


        
      </div>

      {/* TABELA */}
      <table style={table}>
        <thead style={{ background: "#0F172A", color: "#fff" }}>
          <tr>
            <th style={thCenter}>ID</th> 
            <th style={thLeft}>Empresa</th>
            <th style={thLeft}>Gateway</th>
            <th style={thLeft}>Meio</th>
            <th style={thLeft}>Status</th>
            <th style={thLeft}>Pagamento</th>
            <th style={thLeft}>Valor</th>
          </tr>
        </thead>

        <tbody>
          {lista.map((p, i) => (
            <tr
              key={p.id}
              style={{ background: i % 2 ? "#E9EDF2" : "#fff" }}
            >
              <td style={{ ...tdCenter  }}>{p.id}</td> 
              <td style={{...tdLeft }}>{p.nome || "-"}</td>
              <td style={{...tdLeft }}>{p.gateway}</td>
              <td style={{...tdLeft }}>{p.meio_pagamento}</td>
              <td style={{...tdLeft }}>{p.status_gateway}</td>
              <td style={{...tdLeft }}>{formatarDataBR(p.data_pagamento)}</td>
              <td style={{...tdLeft }}>
                {Number(p.valor_pago).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </td>
            </tr>
          ))}

          {/* TOTAL */}
          {lista.length > 0 && (
            <tr style={{ background: "#F1F5F9", borderTop: "2px solid #0F172A" }}>
              <td colSpan={6} style={{ ...tdRight, fontWeight: "bold" }}>
                TOTAL
              </td>
              <td style={{ ...tdLeft, fontWeight: "bold" }}>
                {totalValor.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </td>
            </tr>
          )}

          {!loading && lista.length === 0 && (
            <tr>
              <td colSpan={8} style={{ padding: 20, textAlign: "center" }}>
                Nenhum pagamento encontrado
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ====== ESTILO PADRÃO (IGUAL ÀS OUTRAS TELAS) ====== */

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

const thCenter = {
  padding: 12,
  textAlign: "center",
};

const thLeft = {
  padding: 12,
  textAlign: "left",
    fontWeight: "bold"
};

const tdCenter = {
  padding: 12,
  textAlign: "center",
    fontWeight: "bold"
};

const tdLeft = {
  padding: 12,
  textAlign: "left",
    fontWeight: "bold"
};

const tdRight = {
  padding: 12,
  textAlign: "right",
};
