 import { useEffect, useState } from "react";
import { buildWebhookUrl } from "../config/globals";
import { hojeLocal, hojeMaisDias } from "../utils/dataLocal";

export default function Cobrancas() {
  const [lista, setLista] = useState([]);
  const [status, setStatus] = useState("TODOS");
  const [inicio, setInicio] = useState(hojeMaisDias(-15));
  const [fim, setFim] = useState(hojeLocal());
  const [loading, setLoading] = useState(false);

  const [acaoEmAndamento, setAcaoEmAndamento] = useState(null);
const [mensagem, setMensagem] = useState("");
const [tipoMensagem, setTipoMensagem] = useState("");


  const [erro, setErro] = useState("");


  function normalizarRetorno(json) {
  if (Array.isArray(json)) {
    return json[0] || {};
  }

  if (Array.isArray(json?.data)) {
    return json.data[0] || {};
  }

  return json || {};
}


  async function carregar() {
    setLoading(true);
    setErro("");

    try {
      const r = await fetch(buildWebhookUrl("consulta_cobrancas"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: status === "TODOS" ? null : status,
          data_inicio: inicio || null,
          data_fim: fim || null,
        }),
      });

      if (!r.ok) {
        throw new Error(`Erro HTTP ${r.status}`);
      }

      const j = await r.json();

      if (Array.isArray(j)) {
        setLista(j);
      } else if (Array.isArray(j?.data)) {
        setLista(j.data);
      } else {
        setLista([]);
      }
    } catch (e) {
      console.error("Erro ao carregar cobranças", e);
      setLista([]);
      setErro("Não foi possível carregar as cobranças.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [status, inicio, fim]);

  function formatarDataBR(data) {
    if (!data) return "-";

    const texto = String(data).substring(0, 10);
    const partes = texto.split("-");

    if (partes.length !== 3) return data;

    const [ano, mes, dia] = partes;

    return `${dia}/${mes}/${ano}`;
  }

  function converterValor(valor) {
    if (valor === null || valor === undefined || valor === "") {
      return 0;
    }

    if (typeof valor === "number") {
      return valor;
    }

    const texto = String(valor).trim();

    if (texto.includes(",") && texto.includes(".")) {
      return Number(
        texto
          .replace(/\./g, "")
          .replace(",", ".")
      );
    }

    return Number(texto.replace(",", "."));
  }

  function formatarValor(valor) {
    const numero = converterValor(valor);

    return (Number.isFinite(numero) ? numero : 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function obterEstiloStatus(statusCobranca) {
    const valor = String(statusCobranca || "").toUpperCase();

    if (valor === "PAGA") {
      return {
        background: "#DCFCE7",
        color: "#166534",
        border: "1px solid #86EFAC",
      };
    }

    if (valor === "ATRASADA") {
      return {
        background: "#FEE2E2",
        color: "#991B1B",
        border: "1px solid #FCA5A5",
      };
    }

    if (valor === "CANCELADA") {
      return {
        background: "#E5E7EB",
        color: "#374151",
        border: "1px solid #CBD5E1",
      };
    }

    return {
      background: "#FEF3C7",
      color: "#92400E",
      border: "1px solid #FCD34D",
    };
  }

  const totalValor = lista.reduce((acc, cobranca) => {
    const valor = converterValor(cobranca.valor);

    return acc + (Number.isFinite(valor) ? valor : 0);
  }, 0);


  async function pagarAssinatura(cobranca) {
  const confirmar = window.confirm(
    `Confirma a quitação da cobrança ${cobranca.id} no valor de ${formatarValor(
      cobranca.valor
    )}?`
  );

  if (!confirmar) return;

  const chaveAcao = `pagar-${cobranca.id}`;

  setAcaoEmAndamento(chaveAcao);
  setMensagem("");
  setTipoMensagem("");

  try {
    const r = await fetch(buildWebhookUrl("pagar_assinatura"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cobranca_id: cobranca.id,
        assinatura_id: cobranca.assinatura_id || null,
        empresa_id: cobranca.empresa_id || null,
      }),
    });

    const json = await r.json();
    const retorno = normalizarRetorno(json);

    if (!r.ok || retorno?.ok === false) {
      throw new Error(
        retorno?.mensagem || "Não foi possível quitar a cobrança."
      );
    }

    setMensagem(
      retorno?.mensagem ||
        `Cobrança ${cobranca.id} quitada com sucesso.`
    );
    setTipoMensagem("sucesso");

    await carregar();
  } catch (erro) {
    console.error("Erro ao quitar cobrança", erro);

    setMensagem(
      erro?.message || "Ocorreu um erro ao quitar a cobrança."
    );
    setTipoMensagem("erro");
  } finally {
    setAcaoEmAndamento(null);
  }
}

async function cancelarAssinatura(cobranca) {
  const confirmar = window.confirm(
    `Confirma o cancelamento da assinatura da empresa ${
      cobranca.empresa_nome || ""
    }?\n\n` +
      "A cobrança será cancelada e o acesso do cliente será bloqueado."
  );

  if (!confirmar) return;

  const chaveAcao = `cancelar-${cobranca.id}`;

  setAcaoEmAndamento(chaveAcao);
  setMensagem("");
  setTipoMensagem("");

  try {
    const r = await fetch(buildWebhookUrl("cancelar_assinatura"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cobranca_id: cobranca.id,
        assinatura_id: cobranca.assinatura_id || null,
        empresa_id: cobranca.empresa_id || null,
      }),
    });

    const json = await r.json();
    const retorno = normalizarRetorno(json);

    if (!r.ok || retorno?.ok === false) {
      throw new Error(
        retorno?.mensagem || "Não foi possível cancelar a assinatura."
      );
    }

    setMensagem(
      retorno?.mensagem ||
        "Assinatura cancelada e acesso bloqueado."
    );
    setTipoMensagem("sucesso");

    await carregar();
  } catch (erro) {
    console.error("Erro ao cancelar assinatura", erro);

    setMensagem(
      erro?.message || "Ocorreu um erro ao cancelar a assinatura."
    );
    setTipoMensagem("erro");
  } finally {
    setAcaoEmAndamento(null);
  }
}
 

  return (
    <div style={pagina}>
      {/* CABEÇALHO */}
      <div style={cabecalhoPagina}>
        <div>
          <h1 style={tituloPagina}>Cobranças</h1>

          <p style={subtituloPagina}>
            Consulte e acompanhe as cobranças das assinaturas.
          </p>
        </div>

        <button
          type="button"
          onClick={carregar}
          disabled={loading}
          style={{
            ...botaoAtualizar,
            opacity: loading ? 0.65 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      {/* FILTROS */}
      <div style={cardFiltros}>
        <div style={tituloFiltros}>Filtros</div>

        <div style={linhaFiltros}>
          <div style={grupoCampo}>
            <label style={label}>Status</label>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={input}
            >
              <option value="TODOS">Todos</option>
              <option value="PENDENTE">Pendente</option>
              <option value="PAGA">Paga</option>
              <option value="ATRASADA">Atrasada</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>

          <div style={grupoCampo}>
            <label style={label}>Data inicial</label>

            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              style={input}
            />
          </div>

          <div style={grupoCampo}>
            <label style={label}>Data final</label>

            <input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              style={input}
            />
          </div>

          <div style={resumoFiltro}>
            <span style={resumoLabel}>Registros</span>
            <strong style={resumoValor}>{lista.length}</strong>
          </div>

          <div style={resumoFiltro}>
            <span style={resumoLabel}>Total</span>
            <strong style={resumoValor}>
              {totalValor.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </strong>
          </div>
        </div>
      </div>

      {mensagem && (
  <div
    style={{
      ...mensagemAcao,
      ...(tipoMensagem === "sucesso"
        ? mensagemSucesso
        : mensagemErro),
    }}
  >
    <span>{mensagem}</span>

    <button
      type="button"
      onClick={() => {
        setMensagem("");
        setTipoMensagem("");
      }}
      style={botaoFecharMensagem}
    >
      ×
    </button>
  </div>
)}



      {erro && <div style={mensagemErro}>{erro}</div>}

      {/* TABELA */}
      <div style={cardTabela}>
        <div style={topoTabela}>
          <div>
            <div style={tituloTabela}>Lista de cobranças</div>

            <div style={descricaoTabela}>
              Período de {formatarDataBR(inicio)} até {formatarDataBR(fim)}
            </div>
          </div>
        </div>

        <div style={tabelaContainer}>
          <table style={table}>
            <thead>
              <tr style={linhaCabecalho}>
                <th style={thCenter}>ID</th>
                <th style={thLeft}>Plano</th>
                <th style={thLeft}>Empresa</th>
                <th style={thCenter}>Status</th>
                <th style={thCenter}>Forma de pagamento</th>
                <th style={thCenter}>Vencimento</th>
                <th style={thCenter}>Competência</th>
                <th style={thRight}>Valor</th>
                <th style={thCenter}>Ações</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} style={estadoTabela}>
                    Carregando cobranças...
                  </td>
                </tr>
              )}

              {!loading &&
                lista.map((c, i) => {
                  const estiloStatus = obterEstiloStatus(
                    c.status_cobranca
                  );

                  return (
                    <tr
                      key={c.id}
                      style={{
                        background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
                        borderBottom: "1px solid #E2E8F0",
                      }}
                    >
                      <td style={tdCenter}>
                        <span style={idBadge}>{c.id}</span>
                      </td>

                      <td style={tdLeft}>
                        <div style={textoPrincipal}>{c.nome || "-"}</div>
                      </td>

                      <td style={tdLeft}>
                        <div style={textoPrincipal}>
                          {c.empresa_nome || "-"}
                        </div>
                      </td>

                      <td style={tdCenter}>
                        <span
                          style={{
                            ...badgeStatus,
                            ...estiloStatus,
                          }}
                        >
                          {c.status_cobranca || "-"}
                        </span>
                      </td>

                      <td style={tdCenter}>
                        <span style={badgeForma}>
                          {c.forma_pagamento || "-"}
                        </span>
                      </td>

                      <td style={tdCenter}>
                        {formatarDataBR(c.data_vencimento)}
                      </td>

                      <td style={tdCenter}>
                        {formatarDataBR(c.competencia)}
                      </td>

                      <td style={tdRightValor}>
                          {formatarValor(c.valor)}
                        </td>

                        <td style={tdCenter}>
                          <button
                            type="button"
                            onClick={() => pagarAssinatura(c)}
                            disabled={
                              acaoEmAndamento !== null ||
                              c.status_cobranca === "PAGA" ||
                              c.status_cobranca === "CANCELADA"
                            }
                            style={{
                              padding: "6px 12px",
                              border: "none",
                              borderRadius: 6,
                              background:
                                c.status_cobranca === "PAGA" ? "#94A3B8" : "#15803D",
                              color: "#FFFFFF",
                              fontWeight: 700,
                              cursor:
                                c.status_cobranca === "PAGA" ? "not-allowed" : "pointer",
                            }}
                          >
                            {c.status_cobranca === "PAGA" ? "Quitada" : "Quitar"}
                          </button>
                        </td>

                    </tr>
                  );
                })}

              {!loading && lista.length === 0 && (
                <tr>
                  <td colSpan={8} style={estadoTabela}>
                    Nenhuma cobrança encontrada para os filtros informados.
                  </td>
                </tr>
              )}
            </tbody>

           <tfoot>
              <tr style={linhaTotal}>
                <td colSpan={7} style={tdTotalLabel}>
                  TOTAL
                </td>

                <td style={tdTotalValor}>
                  {totalValor.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </td>

                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ESTILOS
========================================================= */

const pagina = {
  width: "100%",
  padding: "18px 22px 30px",
  boxSizing: "border-box",
  background: "#F8FAFC",
  minHeight: "100%",
};

const cabecalhoPagina = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 16,
  flexWrap: "wrap",
};

const tituloPagina = {
  margin: 0,
  color: "#0F172A",
  fontSize: 26,
  fontWeight: 800,
};

const subtituloPagina = {
  margin: "5px 0 0",
  color: "#64748B",
  fontSize: 14,
};

const botaoAtualizar = {
  minWidth: 110,
  padding: "9px 16px",
  border: "1px solid #1D4ED8",
  borderRadius: 8,
  background: "#2563EB",
  color: "#FFFFFF",
  fontSize: 13,
  fontWeight: 700,
};

const cardFiltros = {
  background: "#415A77",
  padding: 18,
  borderRadius: 10,
  color: "#FFFFFF",
  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.10)",
};

const tituloFiltros = {
  fontSize: 15,
  fontWeight: 800,
  marginBottom: 12,
};

const linhaFiltros = {
  display: "flex",
  alignItems: "flex-end",
  gap: 14,
  flexWrap: "wrap",
};

const grupoCampo = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  minWidth: 155,
};

const label = {
  fontSize: 12,
  fontWeight: 700,
  color: "#E2E8F0",
};

const input = {
  height: 36,
  padding: "0 10px",
  borderRadius: 6,
  border: "1px solid #CBD5E1",
  background: "#FFFFFF",
  color: "#0F172A",
  fontSize: 13,
  fontWeight: 600,
  outline: "none",
  boxSizing: "border-box",
};

const resumoFiltro = {
  minWidth: 125,
  minHeight: 36,
  padding: "6px 12px",
  borderRadius: 7,
  background: "rgba(15, 23, 42, 0.28)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  boxSizing: "border-box",
};

const resumoLabel = {
  fontSize: 10,
  color: "#CBD5E1",
  fontWeight: 700,
  textTransform: "uppercase",
};

const resumoValor = {
  marginTop: 2,
  fontSize: 14,
  color: "#FFFFFF",
};

const mensagemErro = {
  marginTop: 14,
  padding: "10px 14px",
  borderRadius: 8,
  background: "#FEE2E2",
  border: "1px solid #FCA5A5",
  color: "#991B1B",
  fontSize: 13,
  fontWeight: 700,
};

const cardTabela = {
  marginTop: 16,
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: 10,
  overflow: "hidden",
  boxShadow: "0 3px 10px rgba(15, 23, 42, 0.06)",
};

const topoTabela = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 16px",
  borderBottom: "1px solid #E2E8F0",
};

const tituloTabela = {
  color: "#0F172A",
  fontSize: 15,
  fontWeight: 800,
};

const descricaoTabela = {
  marginTop: 3,
  color: "#64748B",
  fontSize: 12,
};

const tabelaContainer = {
  width: "100%",
  overflowX: "auto",
};

const table = {
  width: "100%",
  minWidth: 980,
  borderCollapse: "collapse",
  color: "#0F172A",
  fontSize: 13,
};

const linhaCabecalho = {
  background: "#0F172A",
  color: "#FFFFFF",
};

const thCenter = {
  padding: "12px 10px",
  textAlign: "center",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const thLeft = {
  padding: "12px 10px",
  textAlign: "left",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const thRight = {
  padding: "12px 14px",
  textAlign: "right",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const tdCenter = {
  padding: "11px 10px",
  textAlign: "center",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};

const tdLeft = {
  padding: "11px 10px",
  textAlign: "left",
  verticalAlign: "middle",
};

const tdRightValor = {
  padding: "11px 14px",
  textAlign: "right",
  verticalAlign: "middle",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const textoPrincipal = {
  color: "#0F172A",
  fontWeight: 700,
};

const idBadge = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 30,
  height: 25,
  padding: "0 7px",
  borderRadius: 6,
  background: "#E2E8F0",
  color: "#334155",
  fontWeight: 800,
};

const badgeStatus = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 88,
  padding: "5px 9px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
};

const badgeForma = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 55,
  padding: "4px 8px",
  borderRadius: 6,
  background: "#DBEAFE",
  color: "#1E40AF",
  fontSize: 11,
  fontWeight: 800,
};

const estadoTabela = {
  padding: 30,
  textAlign: "center",
  color: "#64748B",
  fontWeight: 700,
};

const linhaTotal = {
  background: "#E2E8F0",
  borderTop: "2px solid #0F172A",
};

const tdTotalLabel = {
  padding: "12px 14px",
  textAlign: "right",
  color: "#0F172A",
  fontWeight: 900,
};

const tdTotalValor = {
  padding: "12px 14px",
  textAlign: "right",
  color: "#0F172A",
  fontWeight: 900,
  whiteSpace: "nowrap",
};