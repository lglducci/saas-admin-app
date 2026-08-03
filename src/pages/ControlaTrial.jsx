 import { useEffect, useMemo, useState } from "react";
import { buildWebhookUrl } from "../config/globals";

export default function ControlaTrial() {
  const [lista, setLista] = useState([]);
  const [filtro, setFiltro] = useState("TODOS");
  const [pesquisa, setPesquisa] = useState("");
  const [diasAdiar, setDiasAdiar] = useState(7);

  const [loading, setLoading] = useState(false);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [tipoMensagem, setTipoMensagem] = useState("");

  function normalizarRetorno(json) {
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.data)) return json.data;
    return json ? [json] : [];
  }

  async function executarWebhook(payload) {
    const resposta = await fetch(buildWebhookUrl("controla_trial"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const texto = await resposta.text();

    let json = [];

    try {
      json = texto ? JSON.parse(texto) : [];
    } catch {
      throw new Error("O webhook retornou uma resposta inválida.");
    }

    if (!resposta.ok) {
      throw new Error(
        json?.mensagem ||
          json?.message ||
          `Erro HTTP ${resposta.status}`
      );
    }

    return normalizarRetorno(json);
  }

  async function carregar() {
    setLoading(true);
    setMensagem("");

    try {
      const dados = await executarWebhook({
        acao: "LISTAR",
        usuario_id: null,
        dias: 7,
      });

      setLista(dados);
    } catch (erro) {
      console.error("Erro ao carregar trials", erro);
      setLista([]);
      setMensagem(
        erro?.message || "Não foi possível carregar os trials."
      );
      setTipoMensagem("erro");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function executarAcao({
    usuario,
    acao,
    dias = 7,
    textoConfirmacao,
    mensagemPadrao,
  }) {
    const confirmou = window.confirm(textoConfirmacao);

    if (!confirmou) return;

    const chave = `${acao}-${usuario.id}`;

    setAcaoEmAndamento(chave);
    setMensagem("");

    try {
      await executarWebhook({
        acao,
        usuario_id: usuario.id,
        dias,
      });

      setMensagem(mensagemPadrao);
      setTipoMensagem("sucesso");

      await carregar();
    } catch (erro) {
      console.error(`Erro na ação ${acao}`, erro);

      setMensagem(
        erro?.message || "Não foi possível executar a ação."
      );
      setTipoMensagem("erro");
    } finally {
      setAcaoEmAndamento("");
    }
  }

  function fecharAcesso(usuario) {
    executarAcao({
      usuario,
      acao: "FECHAR_ACESSO",
      textoConfirmacao:
        `Fechar o acesso de ${usuario.nome}?\n\n` +
        "O acompanhamento comercial continuará ativo.",
      mensagemPadrao: `Acesso de ${usuario.nome} bloqueado.`,
    });
  }

  function adiarTrial(usuario) {
    executarAcao({
      usuario,
      acao: "ADIAR_TRIAL",
      dias: Number(diasAdiar),
      textoConfirmacao:
        `Conceder mais ${diasAdiar} dias para ${usuario.nome}?`,
      mensagemPadrao:
        `Trial de ${usuario.nome} adiado por ${diasAdiar} dias.`,
    });
  }

  function concederLivre(usuario) {
    executarAcao({
      usuario,
      acao: "CONCEDER_LIVRE",
      textoConfirmacao:
        `Conceder acesso livre para ${usuario.nome}?\n\n` +
        "O acesso não terá data de vencimento.",
      mensagemPadrao:
        `${usuario.nome} recebeu acesso livre.`,
    });
  }

  function formatarData(data) {
    if (!data) return "-";

    const texto = String(data).substring(0, 10);
    const [ano, mes, dia] = texto.split("-");

    if (!ano || !mes || !dia) return "-";

    return `${dia}/${mes}/${ano}`;
  }

  function obterStatus(usuario) {
    return String(usuario.situacao_trial || "INDEFINIDO").toUpperCase();
  }

  function estiloSituacao(situacao) {
    switch (situacao) {
      case "TRIAL_ATIVO":
        return {
          background: "#DCFCE7",
          color: "#166534",
          border: "1px solid #86EFAC",
        };

      case "TRIAL_VENCIDO_COM_ACESSO":
        return {
          background: "#FFEDD5",
          color: "#9A3412",
          border: "1px solid #FDBA74",
        };

      case "TRIAL_VENCIDO_BLOQUEADO":
      case "ACESSO_BLOQUEADO":
        return {
          background: "#FEE2E2",
          color: "#991B1B",
          border: "1px solid #FCA5A5",
        };

      case "ACESSO_LIVRE":
        return {
          background: "#DBEAFE",
          color: "#1E40AF",
          border: "1px solid #93C5FD",
        };

      default:
        return {
          background: "#E2E8F0",
          color: "#334155",
          border: "1px solid #CBD5E1",
        };
    }
  }

  const listaFiltrada = useMemo(() => {
    const texto = pesquisa.trim().toLowerCase();

    return lista.filter((usuario) => {
      const situacao = obterStatus(usuario);

      const correspondeFiltro =
        filtro === "TODOS" ||
        filtro === situacao ||
        (filtro === "PRECISA_CONTATO" &&
          usuario.precisa_contato === true);

      const correspondePesquisa =
        !texto ||
        String(usuario.nome || "").toLowerCase().includes(texto) ||
        String(usuario.email || "").toLowerCase().includes(texto) ||
        String(usuario.telefone || "").toLowerCase().includes(texto);

      return correspondeFiltro && correspondePesquisa;
    });
  }, [lista, filtro, pesquisa]);

  const resumo = useMemo(() => {
    return {
      total: lista.length,

      ativos: lista.filter(
        (u) => obterStatus(u) === "TRIAL_ATIVO"
      ).length,

      vencidos: lista.filter(
        (u) =>
          obterStatus(u) === "TRIAL_VENCIDO_COM_ACESSO" ||
          obterStatus(u) === "TRIAL_VENCIDO_BLOQUEADO"
      ).length,

      contato: lista.filter(
        (u) => u.precisa_contato === true
      ).length,

      livres: lista.filter(
        (u) => obterStatus(u) === "ACESSO_LIVRE"
      ).length,
    };
  }, [lista]);

  return (
    <div style={pagina}>
      <div style={cabecalho}>
        <div>
          <h1 style={titulo}>Controle de Trial</h1>

          <p style={subtitulo}>
            Controle de vencimentos, bloqueios, prorrogações e
            acessos livres.
          </p>
        </div>

        <button
          type="button"
          onClick={carregar}
          disabled={loading}
          style={{
            ...botaoAtualizar,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      <div style={cardsResumo}>
        <Resumo titulo="Usuários" valor={resumo.total} />
        <Resumo titulo="Trials ativos" valor={resumo.ativos} />
        <Resumo titulo="Trials vencidos" valor={resumo.vencidos} />
        <Resumo titulo="Precisam contato" valor={resumo.contato} />
        <Resumo titulo="Acesso livre" valor={resumo.livres} />
      </div>

      <div style={cardFiltros}>
        <div style={grupoCampo}>
          <label style={label}>Situação</label>

          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            style={input}
          >
            <option value="TODOS">Todas as situações</option>
            <option value="TRIAL_ATIVO">Trial ativo</option>

            <option value="TRIAL_VENCIDO_COM_ACESSO">
              Vencido com acesso
            </option>

            <option value="TRIAL_VENCIDO_BLOQUEADO">
              Vencido e bloqueado
            </option>

            <option value="PRECISA_CONTATO">
              Precisa de contato
            </option>

            <option value="ACESSO_LIVRE">
              Acesso livre
            </option>

            <option value="ACESSO_BLOQUEADO">
              Acesso bloqueado
            </option>
          </select>
        </div>

        <div style={{ ...grupoCampo, minWidth: 280 }}>
          <label style={label}>Pesquisar</label>

          <input
            type="text"
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
            placeholder="Nome, e-mail ou telefone"
            style={input}
          />
        </div>

        <div style={grupoCampo}>
          <label style={label}>Prazo para adiar</label>

          <select
            value={diasAdiar}
            onChange={(e) => setDiasAdiar(Number(e.target.value))}
            style={input}
          >
            <option value={7}>7 dias</option>
            <option value={15}>15 dias</option>
            <option value={30}>30 dias</option>
          </select>
        </div>
      </div>

      {mensagem && (
        <div
          style={{
            ...alerta,
            ...(tipoMensagem === "sucesso"
              ? alertaSucesso
              : alertaErro),
          }}
        >
          <span>{mensagem}</span>

          <button
            type="button"
            onClick={() => setMensagem("")}
            style={fecharAlerta}
          >
            ×
          </button>
        </div>
      )}

      <div style={cardTabela}>
        <div style={topoTabela}>
          <div>
            <div style={tituloTabela}>Usuários e trials</div>

            <div style={descricaoTabela}>
              {listaFiltrada.length} registro(s) exibido(s)
            </div>
          </div>
        </div>

        <div style={containerTabela}>
          <table style={table}>
            <thead>
              <tr style={cabecalhoTabela}>
                <th style={thCenter}>ID</th>
                <th style={thLeft}>Usuário</th>
                <th style={thLeft}>Contato</th>
                <th style={thCenter}>Plano</th>
                <th style={thCenter}>Situação</th>
                <th style={thCenter}>Início</th>
                <th style={thCenter}>Fim</th>
                <th style={thCenter}>Prazo</th>
                <th style={thCenter}>Acesso</th>
                <th style={thCenter}>Mensagens</th>
                <th style={thCenter}>Ações</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={11} style={estadoTabela}>
                    Carregando usuários...
                  </td>
                </tr>
              )}

              {!loading &&
                listaFiltrada.map((usuario, indice) => {
                  const situacao = obterStatus(usuario);
                  const processando =
                    acaoEmAndamento.endsWith(`-${usuario.id}`);

                  return (
                    <tr
                      key={usuario.id}
                      style={{
                        background:
                          indice % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
                        borderBottom: "1px solid #E2E8F0",
                      }}
                    >
                      <td style={tdCenter}>
                        <span style={badgeId}>{usuario.id}</span>
                      </td>

                      <td style={tdLeft}>
                        <div style={nomeUsuario}>{usuario.nome}</div>
                        <div style={emailUsuario}>{usuario.email}</div>
                      </td>

                      <td style={tdLeft}>
                        {usuario.telefone || "-"}
                      </td>

                      <td style={tdCenter}>
                        <span style={badgePlano}>
                          {usuario.plano || "-"}
                        </span>
                      </td>

                      <td style={tdCenter}>
                        <span
                          style={{
                            ...badgeSituacao,
                            ...estiloSituacao(situacao),
                          }}
                        >
                          {situacao.replaceAll("_", " ")}
                        </span>
                      </td>

                      <td style={tdCenter}>
                        {formatarData(usuario.trial_inicio)}
                      </td>

                      <td style={tdCenter}>
                        {formatarData(usuario.trial_fim)}
                      </td>

                      <td style={tdCenter}>
                        {usuario.dias_concedidos === null
                          ? "Livre"
                          : `${usuario.dias_concedidos} dias`}
                      </td>

                      <td style={tdCenter}>
                        <span
                          style={{
                            ...badgeAcesso,
                            background: usuario.ativo
                              ? "#DCFCE7"
                              : "#FEE2E2",
                            color: usuario.ativo
                              ? "#166534"
                              : "#991B1B",
                          }}
                        >
                          {usuario.ativo ? "Liberado" : "Bloqueado"}
                        </span>
                      </td>

                      <td style={tdCenter}>
                        <div style={mensagensInfo}>
                          <strong>
                            {usuario.trial_qtd_mensagens || 0}
                          </strong>

                          {usuario.precisa_contato && (
                            <span style={badgeContato}>
                              Contatar
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={tdCenter}>
                        <div style={acoes}>
                          <button
                            type="button"
                            onClick={() => fecharAcesso(usuario)}
                            disabled={
                              processando ||
                              usuario.ativo === false ||
                              situacao === "ACESSO_LIVRE"
                            }
                            style={{
                              ...botaoAcao,
                              ...botaoFechar,
                            }}
                          >
                            Fechar
                          </button>

                          <button
                            type="button"
                            onClick={() => adiarTrial(usuario)}
                            disabled={
                              processando ||
                              situacao === "ACESSO_LIVRE"
                            }
                            style={{
                              ...botaoAcao,
                              ...botaoAdiar,
                            }}
                          >
                            +{diasAdiar}d
                          </button>

                          <button
                            type="button"
                            onClick={() => concederLivre(usuario)}
                            disabled={
                              processando ||
                              situacao === "ACESSO_LIVRE"
                            }
                            style={{
                              ...botaoAcao,
                              ...botaoLivre,
                            }}
                          >
                            Livre
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {!loading && listaFiltrada.length === 0 && (
                <tr>
                  <td colSpan={11} style={estadoTabela}>
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Resumo({ titulo, valor }) {
  return (
    <div style={cardResumo}>
      <span style={cardResumoTitulo}>{titulo}</span>
      <strong style={cardResumoValor}>{valor}</strong>
    </div>
  );
}

const pagina = {
  width: "100%",
  padding: "18px 22px 30px",
  boxSizing: "border-box",
  background: "#F8FAFC",
  minHeight: "100%",
};

const cabecalho = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 16,
  flexWrap: "wrap",
};

const titulo = {
  margin: 0,
  color: "#0F172A",
  fontSize: 26,
  fontWeight: 800,
};

const subtitulo = {
  margin: "5px 0 0",
  color: "#64748B",
  fontSize: 14,
};

const botaoAtualizar = {
  padding: "9px 16px",
  border: "1px solid #1D4ED8",
  borderRadius: 8,
  background: "#2563EB",
  color: "#FFFFFF",
  fontWeight: 800,
  cursor: "pointer",
};

const cardsResumo = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
  marginBottom: 14,
};

const cardResumo = {
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: 9,
  padding: "12px 14px",
  boxShadow: "0 2px 6px rgba(15, 23, 42, 0.05)",
};

const cardResumoTitulo = {
  display: "block",
  color: "#64748B",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
};

const cardResumoValor = {
  display: "block",
  marginTop: 4,
  color: "#0F172A",
  fontSize: 22,
};

const cardFiltros = {
  display: "flex",
  alignItems: "flex-end",
  gap: 14,
  flexWrap: "wrap",
  padding: 16,
  borderRadius: 10,
  background: "#415A77",
  color: "#FFFFFF",
};

const grupoCampo = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  minWidth: 180,
};

const label = {
  color: "#E2E8F0",
  fontSize: 12,
  fontWeight: 800,
};

const input = {
  height: 36,
  padding: "0 10px",
  border: "1px solid #CBD5E1",
  borderRadius: 6,
  background: "#FFFFFF",
  color: "#0F172A",
  fontWeight: 600,
  boxSizing: "border-box",
};

const alerta = {
  marginTop: 14,
  padding: "11px 14px",
  borderRadius: 8,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontWeight: 700,
};

const alertaSucesso = {
  background: "#DCFCE7",
  border: "1px solid #86EFAC",
  color: "#166534",
};

const alertaErro = {
  background: "#FEE2E2",
  border: "1px solid #FCA5A5",
  color: "#991B1B",
};

const fecharAlerta = {
  border: "none",
  background: "transparent",
  color: "inherit",
  fontSize: 20,
  cursor: "pointer",
};

const cardTabela = {
  marginTop: 16,
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: 10,
  overflow: "hidden",
};

const topoTabela = {
  padding: "13px 16px",
  borderBottom: "1px solid #E2E8F0",
};

const tituloTabela = {
  color: "#0F172A",
  fontWeight: 800,
};

const descricaoTabela = {
  marginTop: 3,
  color: "#64748B",
  fontSize: 12,
};

const containerTabela = {
  overflowX: "auto",
};

const table = {
  width: "100%",
  minWidth: 1320,
  borderCollapse: "collapse",
  fontSize: 12,
};

const cabecalhoTabela = {
  background: "#0F172A",
  color: "#FFFFFF",
};

const thCenter = {
  padding: "11px 8px",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const thLeft = {
  padding: "11px 8px",
  textAlign: "left",
  whiteSpace: "nowrap",
};

const tdCenter = {
  padding: "10px 8px",
  textAlign: "center",
  verticalAlign: "middle",
};

const tdLeft = {
  padding: "10px 8px",
  textAlign: "left",
  verticalAlign: "middle",
};

const badgeId = {
  display: "inline-flex",
  minWidth: 28,
  justifyContent: "center",
  padding: "4px 7px",
  borderRadius: 6,
  background: "#E2E8F0",
  color: "#334155",
  fontWeight: 800,
};

const nomeUsuario = {
  color: "#0F172A",
  fontWeight: 800,
};

const emailUsuario = {
  marginTop: 2,
  color: "#64748B",
  fontSize: 11,
};

const badgePlano = {
  display: "inline-flex",
  padding: "4px 8px",
  borderRadius: 6,
  background: "#DBEAFE",
  color: "#1E40AF",
  fontWeight: 800,
};

const badgeSituacao = {
  display: "inline-flex",
  justifyContent: "center",
  padding: "5px 8px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const badgeAcesso = {
  display: "inline-flex",
  padding: "5px 8px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 900,
};

const mensagensInfo = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
};

const badgeContato = {
  padding: "3px 6px",
  borderRadius: 999,
  background: "#FEF3C7",
  color: "#92400E",
  fontSize: 9,
  fontWeight: 900,
};

const acoes = {
  display: "flex",
  justifyContent: "center",
  gap: 5,
  whiteSpace: "nowrap",
};

const botaoAcao = {
  border: "none",
  borderRadius: 6,
  padding: "6px 8px",
  color: "#FFFFFF",
  fontSize: 10,
  fontWeight: 900,
  cursor: "pointer",
};

const botaoFechar = {
  background: "#B91C1C",
};

const botaoAdiar = {
  background: "#2563EB",
};

const botaoLivre = {
  background: "#15803D",
};

const estadoTabela = {
  padding: 30,
  textAlign: "center",
  color: "#64748B",
  fontWeight: 700,
};