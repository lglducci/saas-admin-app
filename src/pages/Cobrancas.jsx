 import { useEffect, useState } from "react";
import { buildWebhookUrl } from "../config/globals";
import { hojeLocal, hojeMaisDias } from "../utils/dataLocal";


export default function Cobrancas() {
  const [lista, setLista] = useState([]);
  const [status, setStatus] = useState("TODOS");
  const [inicio, setInicio] = useState(hojeMaisDias(-15));
  const [fim, setFim] = useState(hojeLocal());
  const [loading, setLoading] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const r = await fetch(buildWebhookUrl("consulta_cobrancas"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: status === "TODOS" ? null : status,
          data_inicio: inicio || null,
          data_fim: fim || null,
        }),
      });

      const j = await r.json();

      if (Array.isArray(j)) setLista(j);
      else if (Array.isArray(j?.data)) setLista(j.data);
      else setLista([]);
    } catch (e) {
      console.error("Erro ao carregar cobranças", e);
      setLista([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [status, inicio, fim]);

      function formatarDataBR(data) {
  if (!data) return "";
  const d = new Date(data);
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const ano = d.getUTCFullYear();
  return `${dia}-${mes}-${ano}`;
}

 const totalValor = lista.reduce((acc, c) => {
  const v = Number(String(c.valor).replace(",", "."));
  return acc + (isNaN(v) ? 0 : v);
}, 0);


  return (
    <div>
      {/* CARD FILTROS */}
      <div style={card}>
        <h2>Cobranças</h2>

        <div style={linha}>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={input}
          >
            <option value="TODOS">Status</option>
            <option value="PENDENTE">Pendente</option>
            <option value="PAGA">Paga</option>
            <option value="ATRASADA">Atrasada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>

          <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            style={input}
          />

          <input
            type="date"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            style={input}
          />
        </div>
      </div>

      {/* TABELA */}
      <table style={table}>
        <thead style={{ background: "#0F172A", color: "#fff" }}>
          <tr>
            <th style={thCenter}>ID</th>
            <th style={thLeft}>Nome</th>
                <th style={thLeft}>Empresa</th> 
            <th style={thCenter}>Status</th>
              <th style={thCenter}>Forma Pagto</th>
            <th style={thCenter}>Vencimento</th>
             <th style={thCenter}>Competência</th>
                 <th style={thCenter}>Valor</th>
          </tr>
        </thead>

        <tbody>
          {lista.map((c, i) => (
            <tr
              key={c.id}
              style={{ background: i % 2 ? "#E9EDF2" : "#fff" }}
            >
              <td style={{ ...tdCenter, fontWeight: "bold" }}>{c.id}</td>
              <td style={tdLeft}>{c.nome || "-"}</td>
                <td style={tdLeft}>{c.empresa_nome || "-"}</td>
               
              <td style={tdCenter}>{c.status_cobranca}</td>
               <td style={tdCenter}>{c.forma_pagamento}</td>
             <td style={tdCenter}>{formatarDataBR(c.data_vencimento)}</td>
               <td style={tdCenter}>{formatarDataBR(c.competencia)}</td>
               <td style={tdCenter}>{c.valor}</td>
            </tr>
          ))}

          {!loading && lista.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: 20, textAlign: "center" }}>
                Nenhuma cobrança encontrada
              </td>
            </tr>
          )}

          <tr style={{ background: "#F1F5F9", borderTop: "2px solid #0F172A" }}>
          <td colSpan={7} style={{ ...tdRight, fontWeight: "bold" }}>
            TOTAL
          </td>
          <td style={{ ...tdCenter, fontWeight: "bold" }}>
            {totalValor.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
    })}
  </td>
</tr>
        </tbody>
      </table>
    </div>
  );
}

/* ====== ESTILO PADRÃO (AUTOSSUFICIENTE) ====== */

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
   fontWeight: "bold"
};

const thCenter = {
  padding: 12,
  textAlign: "center",
   fontWeight: "bold"
};

const thLeft = {
  padding: 12,
  textAlign: "left",
};

const tdCenter = {
  padding: 12,
  textAlign: "center",
};

const tdLeft = {
  padding: 12,
  textAlign: "left",
};

const tdRight = {
  padding: 12,
  textAlign: "right",
};
