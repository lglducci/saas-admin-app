 import { NavLink } from "react-router-dom";

export default function Sidebar() {
  const linkStyle = ({ isActive }) => ({
    padding: "8px 12px",
    textDecoration: "none",
    color: "#000",
    background: isActive ? "#eee" : "transparent"
  });

  return (
    <aside
      style={{
        width: 220,
        borderRight: "1px solid #ccc",
        paddingTop: 16
      }}
    >
      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <NavLink to="/" style={linkStyle}>Dashboard</NavLink>
        <NavLink to="/assinaturas" style={linkStyle}>Assinaturas</NavLink>
        <NavLink to="/cobrancas" style={linkStyle}>Cobranças</NavLink>
        <NavLink to="/pagamentos" style={linkStyle}>Pagamentos</NavLink>
      </nav>
    </aside>
  );
}
