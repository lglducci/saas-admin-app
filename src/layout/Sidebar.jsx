 import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

const itensMenu = [
  { to: "/", nome: "Dashboard", icone: "▦", end: true },
  { to: "/assinaturas", nome: "Assinaturas", icone: "◈" },
  { to: "/cobrancas", nome: "Cobranças", icone: "$" },
  { to: "/pagamentos", nome: "Pagamentos", icone: "✓" },
  { to: "/modelos", nome: "Modelos", icone: "▤" },
  { to: "/categoria-modelo", nome: "CategoriaModelos", icone: "◫" },
  { to: "/controla-trial", nome: "Controla Trial", icone: "◷" },
  { to: "/prospectflow", nome: "Prospect Flow", icone: "↗" },
];

export default function Sidebar() {
  const [recolhido, setRecolhido] = useState(() => {
    return localStorage.getItem("admin_sidebar_recolhido") === "true";
  });

  useEffect(() => {
    localStorage.setItem("admin_sidebar_recolhido", String(recolhido));
  }, [recolhido]);

  const linkStyle = ({ isActive }) => ({
    display: "flex",
    minHeight: 40,
    alignItems: "center",
    justifyContent: recolhido ? "center" : "flex-start",
    gap: recolhido ? 0 : 10,
    padding: recolhido ? "8px 0" : "8px 12px",
    borderLeft: `3px solid ${isActive ? "#00a884" : "transparent"}`,
    background: isActive ? "#eef2f5" : "transparent",
    color: isActive ? "#087d69" : "#334155",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: isActive ? 700 : 500,
    whiteSpace: "nowrap",
    overflow: "hidden",
    transition: "background 160ms ease, color 160ms ease",
  });

  return (
    <aside
      style={{
        width: recolhido ? 64 : 220,
        flex: `0 0 ${recolhido ? 64 : 220}px`,
        minHeight: "100vh",
        borderRight: "1px solid #d7dde3",
        background: "#ffffff",
        overflow: "hidden",
        transition: "width 220ms ease, flex-basis 220ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          height: 52,
          alignItems: "center",
          justifyContent: recolhido ? "center" : "flex-end",
          padding: recolhido ? 0 : "0 10px",
          borderBottom: "1px solid #eef2f5",
        }}
      >
        <button
          type="button"
          onClick={() => setRecolhido((valor) => !valor)}
          aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
          title={recolhido ? "Expandir menu" : "Recolher menu"}
          style={{
            display: "flex",
            width: 32,
            height: 32,
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            background: "#f8fafc",
            color: "#475569",
            fontSize: 22,
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          {recolhido ? "›" : "‹"}
        </button>
      </div>

      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 3,
          padding: "8px 0",
        }}
      >
        {itensMenu.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={linkStyle}
            title={recolhido ? item.nome : undefined}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                width: 30,
                flex: "0 0 30px",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              {item.icone}
            </span>

            {!recolhido && <span>{item.nome}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
