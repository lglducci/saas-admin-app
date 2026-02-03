 import { useEffect, useMemo, useState } from "react";
import { buildWebhookUrl } from "../config/globals";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

/* =========================
   Utils
========================= */
const num = (v) => {
  const n = Number(String(v ?? 0).replace(",", "."));
  return isNaN(n) ? 0 : n;
};

const brl = (v) =>
  num(v).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const COLORS = ["#22C55E", "#F59E0B", "#EF4444", "#3B82F6"];

/* =========================
   Dashboard
========================= */
export default function Dashboard() {
  const [cards, setCards] = useState({});
  const [graficos, setGraficos] = useState({});
  const [loading, setLoading] = useState(true);

  /* ===== CARREGAMENTO ===== */
  async function carregarDashboard() {
    setLoading(true);
    try {
      const [rc, rg] = await Promise.all([
        fetch(buildWebhookUrl("dashbord_card"), { method: "POST" }),
        fetch(buildWebhookUrl("dashboard_graficos"), { method: "POST" }),
      ]);
    const jc = await rc.json();
    const jg = await rg.json();

    console.log("JC (cards):", jc);
    console.log("JG (graficos):", jg);

    setCards(Array.isArray(jc) ? jc[0] : jc);
    setGraficos(Array.isArray(jg) ? jg[0] :jg);
  } catch (e) {
    console.error("Erro dashboard:", e);
  } finally {
    setLoading(false);
  }
}

  useEffect(() => {
    carregarDashboard();
  }, []);

  /* ===== DADOS ===== */
  const faturamentoMensal = useMemo(
    () =>
      (graficos.faturamento_mensal || []).map((x) => ({
        mes: x.mes,
        valor: num(x.valor),
      })),
    [graficos]
  );

  const cobrancasStatus = useMemo(
    () =>
      (graficos.cobrancas_status || []).map((x) => ({
        name: x.status,
        value: num(x.total),
      })),
    [graficos]
  );

  const assinaturasMes = useMemo(
    () =>
      (graficos.assinaturas_mes || []).map((x) => ({
        mes: x.mes,
        ativas: num(x.ativas),
        canceladas: num(x.canceladas),
      })),
    [graficos]
  );

  /* ===== UI ===== */
  return (
    <div
      style={{
        background: "#ffff",
        color: "#0F172A",
        minHeight: "100vh",
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: "bold" }}>Dashboard</h1>
      <p style={{ color: "#94A3B8", marginBottom: 20 }}>
        Visão geral de faturamento, assinaturas e cobranças
      </p>

      <button
        onClick={carregarDashboard}
        style={{
          marginBottom: 24,
          padding: "8px 16px",
          background: "#2563EB",
          border: 0,
          borderRadius: 6,
          color: "#ffff",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        Atualizar
      </button>

      {/* ===== CARDS ===== */}
      <Grid>
        <Kpi title="Assinaturas Ativas" value={cards.assinaturas_ativas} />
        <Kpi title="Inadimplentes" value={cards.inadimplentes} />
        <Kpi title="Canceladas" value={cards.assinaturas_canceladas} />
        <Kpi title="Faturamento (Mês)" value={brl(cards.faturamento_mes)} />
        <Kpi title="Faturamento Total" value={brl(cards.faturamento_total)} />
        <Kpi
          title="Faturamento Líquido (-27,5%)"
          value={brl(cards.faturamento_liquido)}
        />
        <Kpi title="Cobranças em Aberto" value={brl(cards.cobrancas_aberto)} />
        <Kpi
          title="Cobranças Atrasadas"
          value={brl(cards.cobrancas_atrasadas)}
        />
      </Grid>

      {/* ===== GRÁFICOS ===== */}
      <Grid cols="2fr 1fr">
        <Box title="Faturamento mensal" hasData={faturamentoMensal.length > 0}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={faturamentoMensal}>
              <CartesianGrid stroke="#061327" />
              <XAxis dataKey="mes" stroke="#fff" />
              <YAxis stroke="#fff" />
              <Tooltip formatter={(v) => brl(v)} />
              <Line dataKey="valor" stroke="#22C55E" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </Box>

        <Box title="Cobranças por status" hasData={cobrancasStatus.length > 0}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Tooltip formatter={(v) => brl(v)} />
              <Legend />
              <Pie data={cobrancasStatus} dataKey="value" outerRadius={100}>
                {cobrancasStatus.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </Box>

        <Box
          title="Assinaturas por mês"
          span
          hasData={assinaturasMes.length > 0}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={assinaturasMes}>
              <CartesianGrid stroke="#334155" />
              <XAxis dataKey="mes" stroke="#fff" />
              <YAxis stroke="#fff" />
              <Tooltip />
              <Legend />
              <Bar dataKey="ativas" fill="#3B82F6" />
              <Bar dataKey="canceladas" fill="#EF4444" />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Grid>

      {loading && <p style={{ color: "#94A3B8" }}>Carregando…</p>}
    </div>
  );
}

/* =========================
   COMPONENTES
========================= */
function Grid({ children, cols = "repeat(4, 1fr)" }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: cols,
        gap: 16,
        marginBottom: 32,
        color: "#d9dad9"
      }}
    >
      {children}
    </div>
  );
}

function Kpi({ title, value }) {
  return (
    <div style={{ background: "#1c7ea9", padding: 16, borderRadius: 8 }}>
      <div style={{ color: "#ebebf3",fontWeight: "bold" }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: "bold" }}>
        {value ?? 0}
      </div>
    </div>
  );
}

function Box({ title, children, span, hasData }) {
  return (
    <div
      style={{
        background: "#151e47",
        padding: 16,
        borderRadius: 8,
        gridColumn: span ? "1 / -1" : undefined,
      }}
    >
      <h3 style={{ marginBottom: 12, fontWeight: "bold" }}>{title}</h3>

      {hasData ? (
        children
      ) : (
        <div
          style={{
            height: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#2e9b5d",
            fontStyle: "italic",
          }}
        >
          Sem dados para exibir
        </div>
      )}
    </div>
  );
}
