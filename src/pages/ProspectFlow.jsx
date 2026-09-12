 import { useCallback, useEffect, useMemo, useState } from "react";
 import { buildWebhookUrl } from "../config/globals";
 
 /*
   ProspectFlow MVP
 
   Webhook unico esperado: prospectflow
 
   Corpo enviado ao n8n:
   {
     "empresa_id": 1,
     "acao": "LISTAR_LEADS",
     "payload": {}
   }
 
   O workflow deve executar:
   SELECT public.prospectflow_api($1, $2, $3::jsonb) AS prospectflow_api;
 
   Parametros:
     $1 = empresa_id
     $2 = acao
     $3 = JSON.stringify(payload)
 */
 
 const filtros = [
   { id: "HOJE", nome: "Hoje" },
     { id: "NOVO", nome: "Novos" },
   { id: "TODOS", nome: "Todos" },
   { id: "AGUARDANDO_MINHA_RESPOSTA", nome: " Aguardando minha resposta" },
   { id: "AGUARDANDO_CLIENTE", nome: "Aguardando cliente" },
   { id: "CONVERTIDO", nome: "Convertidos" },
   { id: "ENCERRADO", nome: "Encerrados" },
   { id: "BLOQUEADO", nome: "Não contatar" },
 ];

 
 
 const leadVazio = {
   id: null,
   tipo_lead: "PJ",
   nome: "",
   empresa_nome: "",
   segmento: "",
   cidade: "",
   telefone: "",
   instagram: "",
   email: "",
   canal_preferido: "WHATSAPP",
   origem: "",
   observacoes: "",
 };
 
 const mensagemVazia = {
   id: null,
   ordem: 1,
   nome: "",
   dias_apos_anterior: 0,
   texto: "",
   ativo: true,
 };
 
 // O SaaS Admin é uma aplicação administrativa e não mantém empresa_id no
 // localStorage. Para o MVP, a empresa do ProspectFlow pode ser configurada no
 // .env; quando não informada, utiliza a empresa 1.
const EMPRESA_PROSPECTFLOW_ID = Number(
  import.meta.env.VITE_PROSPECTFLOW_EMPRESA_ID || 1,
);

// Polling leve para manter a central atualizada sem recarregar ou piscar a tela.
const ATUALIZACAO_AUTOMATICA_MS = 15_000;
 
 function normalizarResposta(valor) {
   let atual = valor;
 
   for (let tentativa = 0; tentativa < 6; tentativa += 1) {
     if (typeof atual === "string") {
       try {
         atual = JSON.parse(atual);
         continue;
       } catch {
         return { ok: false, mensagem: atual };
       }
     }
 
     if (Array.isArray(atual)) {
       atual = atual[0] ?? {};
       continue;
     }
 
     const proximo =
       atual?.prospectflow_api ??
       atual?.data?.[0]?.prospectflow_api ??
       atual?.data?.prospectflow_api ??
       atual?.resultado?.prospectflow_api ??
       atual?.body?.prospectflow_api;
 
     if (proximo !== undefined) {
       atual = proximo;
       continue;
     }
 
     return atual || {};
   }
 
   return atual || {};
 }
 
 function dataBR(valor) {
   if (!valor) return "-";
   const texto = String(valor).slice(0, 10);
   const [ano, mes, dia] = texto.split("-");
   return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
 }
 
 function dataHoraBR(valor) {
   if (!valor) return "-";
   return new Date(valor).toLocaleString("pt-BR");
 }
 
 function statusVisual(status) {
   const mapa = {
     NOVO: ["Novo", "bg-sky-100 text-sky-700"],
     EM_CADENCIA: ["Aguardando resposta", "bg-amber-100 text-amber-700"],
     AGUARDANDO_MINHA_RESPOSTA: [
       "Aguardando você",
       "bg-violet-100 text-violet-700",
     ],
     AGUARDANDO_CLIENTE: ["Aguardando cliente", "bg-blue-100 text-blue-700"],
     CONVERTIDO: ["Convertido", "bg-emerald-100 text-emerald-700"],
     ENCERRADO: ["Encerrado", "bg-slate-200 text-slate-700"],
     BLOQUEADO: ["Não contatar", "bg-red-100 text-red-700"],
   };
 
   return mapa[status] || [status || "-", "bg-slate-100 text-slate-600"];
 }
 
 function interacaoVisual(tipo) {
   const mapa = {
     ENVIO: "Você",
     RESPOSTA: "Lead",
     ANOTACAO: "Sistema",
     BLOQUEIO: "Bloqueio",
     CONVERSAO: "Conversão",
   };
 
   return mapa[tipo] || tipo || "Sistema";
 }
 
 function canalVisual(canal) {
   const mapa = {
     WHATSAPP: {
       nome: "WhatsApp",
       icone: "◉",
       classe: "bg-emerald-50 text-emerald-700 ring-emerald-200",
       borda: "border-t-emerald-500",
       faixa: "from-emerald-500 to-teal-500",
     },
     INSTAGRAM: {
       nome: "Instagram",
       icone: "◎",
       classe: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
       borda: "border-t-fuchsia-500",
       faixa: "from-fuchsia-500 to-violet-500",
     },
     EMAIL: {
       nome: "E-mail",
       icone: "✉",
       classe: "bg-blue-50 text-blue-700 ring-blue-200",
       borda: "border-t-blue-500",
       faixa: "from-blue-500 to-cyan-500",
     },
     TELEFONE: {
       nome: "Telefone",
       icone: "☎",
       classe: "bg-amber-50 text-amber-700 ring-amber-200",
       borda: "border-t-amber-500",
       faixa: "from-amber-500 to-orange-500",
     },
   };
 
   return (
     mapa[canal] || {
       nome: canal || "Canal",
       icone: "•",
       classe: "bg-slate-50 text-slate-600 ring-slate-200",
       borda: "border-t-slate-400",
       faixa: "from-slate-500 to-slate-600",
     }
   );
 }
 
 function iniciaisLead(nome) {
   return String(nome || "L")
     .trim()
     .split(/\s+/)
     .slice(0, 2)
     .map((parte) => parte[0])
     .join("")
     .toUpperCase();
 }
 
 export default function ProspectFlow() {
   const empresaId = EMPRESA_PROSPECTFLOW_ID;
 
   const [aba, setAba] = useState("LEADS");
   const [filtro, setFiltro] = useState("HOJE");
   const [busca, setBusca] = useState("");
   const [leads, setLeads] = useState([]);
   const [resumo, setResumo] = useState({});
   const [mensagens, setMensagens] = useState([]);
   const [rascunhos, setRascunhos] = useState({});
   const [carregando, setCarregando] = useState(false);
   const [executando, setExecutando] = useState(null);
   const [erro, setErro] = useState("");
 
   const [modalLead, setModalLead] = useState(false);
   const [formLead, setFormLead] = useState(leadVazio);
   const [modalImportacao, setModalImportacao] = useState(false);
   const [arquivoImportacao, setArquivoImportacao] = useState(null);
   const [tipoImportacao, setTipoImportacao] = useState("LEADS");
   const [resultadoImportacao, setResultadoImportacao] = useState("");
   const [modalMensagem, setModalMensagem] = useState(false);
   const [formMensagem, setFormMensagem] = useState(mensagemVazia);
   const [modalHistorico, setModalHistorico] = useState(false);
   const [leadHistorico, setLeadHistorico] = useState(null);
   const [historico, setHistorico] = useState([]);
   const [leadSelecionadoId, setLeadSelecionadoId] = useState(null);
   const [modalEnvio, setModalEnvio] = useState(null);
   const [modalAcao, setModalAcao] = useState(null);
   const [textoAcao, setTextoAcao] = useState("");
 
   const chamarApi = useCallback(
     async (acao, payload = {}) => {
       if (!empresaId) {
         throw new Error("Empresa não identificada.");
       }
 
       const resposta = await fetch(buildWebhookUrl("prospectflow"), {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           empresa_id: Number(empresaId),
           acao,
           payload,
         }),
       });
 
       const texto = await resposta.text();
       let json = {};
 
       try {
         json = texto ? JSON.parse(texto) : {};
       } catch {
         throw new Error(texto || "O webhook não retornou um JSON válido.");
       }
 
       const retorno = normalizarResposta(json);
 
       if (!resposta.ok || retorno?.ok === false) {
         throw new Error(
           retorno?.mensagem ||
             retorno?.message ||
             `Erro no ProspectFlow (${resposta.status}).`,
         );
       }
 
       return retorno;
     },
     [empresaId],
   );
 
   const enviarMensagemWhatsApp = useCallback(
     async ({
       leadId,
       telefone,
       mensagem,
       tipoEnvio = "CONVERSA",
       mensagemId = null,
     }) => {
       let numero = String(telefone || "").replace(/\D/g, "");
       const textoMensagem = String(mensagem || "").trim();
 
       if (!numero) {
         throw new Error("Este lead não possui telefone.");
       }
 
       if (numero.length === 10 || numero.length === 11) {
         numero = `55${numero}`;
       }
 
       if (!textoMensagem) {
         throw new Error("Digite a mensagem que será enviada ao lead.");
       }
 
       const resposta = await fetch(
         buildWebhookUrl("prospectflow-enviar-mensagem"),
         {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
             empresa_id: Number(empresaId),
             lead_id: Number(leadId),
             telefone: numero,
             mensagem: textoMensagem,
             tipo_envio: tipoEnvio,
             mensagem_id: mensagemId ? Number(mensagemId) : null,
           }),
         },
       );
 
       const textoResposta = await resposta.text();
       let json = {};
 
       try {
         json = textoResposta ? JSON.parse(textoResposta) : {};
       } catch {
         throw new Error(
           textoResposta || "O webhook de envio não retornou um JSON válido.",
         );
       }
 
       const retorno = normalizarResposta(json);
 
       if (!resposta.ok || retorno?.ok === false) {
         throw new Error(
           retorno?.mensagem ||
             retorno?.message ||
             `Erro ao enviar a mensagem (${resposta.status}).`,
         );
       }
 
       return retorno;
     },
     [empresaId],
   );
 
   const carregarLeads = useCallback(async ({ silencioso = false } = {}) => {
     try {
       if (!silencioso) setCarregando(true);
       setErro("");
    
 
      const filtroApi =
  ["NOVO", "AGUARDANDO_CLIENTE"].includes(filtro)
    ? "TODOS"
    : filtro;

const retorno = await chamarApi("LISTAR_LEADS", {
  filtro: filtroApi,
  busca: busca.trim(),
});

const leadsRecebidos = Array.isArray(retorno?.dados)
  ? retorno.dados
  : [];

const novosLeads =
  filtro === "NOVO"
    ? leadsRecebidos.filter((lead) => lead.status === "NOVO")
    : filtro === "AGUARDANDO_CLIENTE"
      ? leadsRecebidos.filter((lead) =>
          ["EM_CADENCIA", "AGUARDANDO_CLIENTE"].includes(lead.status),
        )
      : leadsRecebidos;
          
       setLeads(novosLeads);
       setResumo(retorno?.resumo || {});
       setRascunhos((atuais) => {
         const novos = { ...atuais };
         novosLeads.forEach((lead) => {
           if (novos[lead.id] === undefined) {
             novos[lead.id] = lead.mensagem_pronta || "";
           }
         });
         return novos;
       });
     } catch (e) {
       if (!silencioso) {
         setErro(e.message || "Erro ao consultar os leads.");
         setLeads([]);
       }
     } finally {
       if (!silencioso) setCarregando(false);
     }
   }, [busca, chamarApi, filtro]);
 
   const carregarMensagens = useCallback(async () => {
     try {
       setCarregando(true);
       setErro("");
       const retorno = await chamarApi("LISTAR_MENSAGENS");
       setMensagens(Array.isArray(retorno?.dados) ? retorno.dados : []);
     } catch (e) {
       setErro(e.message || "Erro ao consultar as mensagens.");
       setMensagens([]);
     } finally {
       setCarregando(false);
     }
   }, [chamarApi]);
 
   useEffect(() => {
     if (aba === "LEADS") {
       const primeiraCarga = window.setTimeout(() => carregarLeads(), 250);
       const atualizarEmSegundoPlano = () => {
         if (document.visibilityState === "visible") {
           carregarLeads({ silencioso: true });
         }
       };
       const intervalo = window.setInterval(
         atualizarEmSegundoPlano,
         ATUALIZACAO_AUTOMATICA_MS,
       );

       document.addEventListener("visibilitychange", atualizarEmSegundoPlano);

       return () => {
         window.clearTimeout(primeiraCarga);
         window.clearInterval(intervalo);
         document.removeEventListener(
           "visibilitychange",
           atualizarEmSegundoPlano,
         );
       };
     }
 
     carregarMensagens();
     return undefined;
   }, [aba, carregarLeads, carregarMensagens]);

   useEffect(() => {
     if (!modalHistorico || !leadHistorico?.id) return undefined;

     const atualizarHistorico = async () => {
       if (document.visibilityState !== "visible") return;

       try {
         const retorno = await chamarApi("HISTORICO", {
           lead_id: leadHistorico.id,
         });
         setHistorico(Array.isArray(retorno?.dados) ? retorno.dados : []);
       } catch {
         // Mantém as mensagens atuais se uma atualização silenciosa falhar.
       }
     };

     const intervalo = window.setInterval(
       atualizarHistorico,
       ATUALIZACAO_AUTOMATICA_MS,
     );

     return () => window.clearInterval(intervalo);
   }, [chamarApi, leadHistorico?.id, modalHistorico]);
 
   const quantidadesFiltro = useMemo(
     () => ({
       HOJE: Number(resumo.para_hoje || 0),
      NOVO: Number(resumo.novos || 0),
       TODOS: Number(resumo.total || 0),
       AGUARDANDO_MINHA_RESPOSTA: Number(
         resumo.aguardando_minha_resposta || 0,
       ),
       AGUARDANDO_CLIENTE: Number(
         resumo.aguardando_cliente ??
           resumo.aguardando_resposta ??
           resumo.em_cadencia ??
           0,
       ),
       CONVERTIDO: Number(resumo.convertidos || 0),
       ENCERRADO: Number(resumo.encerrados || 0),
       BLOQUEADO: Number(resumo.bloqueados || 0),
     }),
     [resumo],
   );

   const leadSelecionado = useMemo(
     () =>
       leads.find((lead) => String(lead.id) === String(leadSelecionadoId)) ??
       leads[0] ??
       null,
     [leadSelecionadoId, leads],
   );

   useEffect(() => {
     if (leads.length === 0) {
       setLeadSelecionadoId(null);
       return;
     }

     const selecionadoAindaExiste = leads.some(
       (lead) => String(lead.id) === String(leadSelecionadoId),
     );

     if (!selecionadoAindaExiste) {
       setLeadSelecionadoId(leads[0].id);
     }
   }, [leadSelecionadoId, leads]);
 
   function abrirNovoLead() {
     setFormLead(leadVazio);
     setModalLead(true);
   }
 
   function abrirImportacao() {
     setArquivoImportacao(null);
     setTipoImportacao("LEADS");
     setResultadoImportacao("");
     setModalImportacao(true);
   }
 
   function baixarModeloImportacao() {
     const cabecalho =
       "nome,telefone,email,instagram,empresa_nome,segmento,cidade,canal_preferido,origem,observacoes\n";
     const exemplo =
       'Maria Silva,16999999999,maria@email.com,@maria,Loja da Maria,Varejo,Igarapava,WHATSAPP,Instagram,"Contato interessado"\n';
     const arquivo = new Blob(["\uFEFF", cabecalho, exemplo], {
       type: "text/csv;charset=utf-8",
     });
     const url = URL.createObjectURL(arquivo);
     const link = document.createElement("a");
     link.href = url;
     link.download = "modelo_importacao_prospectflow.csv";
     document.body.appendChild(link);
     link.click();
     link.remove();
     URL.revokeObjectURL(url);
   }
 
   async function importarContatos() {
     if (!arquivoImportacao) {
       setResultadoImportacao("Selecione um arquivo CSV, XLS ou XLSX.");
       return;
     }
 
     const extensao = arquivoImportacao.name.split(".").pop()?.toLowerCase();
     if (!["csv", "xls", "xlsx"].includes(extensao)) {
       setResultadoImportacao("Formato inválido. Utilize CSV, XLS ou XLSX.");
       return;
     }
 
     try {
       setExecutando("IMPORTAR_CONTATOS");
       setResultadoImportacao("");
 
       const formData = new FormData();
       formData.append("empresa_id", String(empresaId));
       formData.append("acao", "IMPORTAR_CONTATOS");
       formData.append("tipo_importacao", tipoImportacao);
       formData.append("arquivo", arquivoImportacao);
 
       const resposta = await fetch(buildWebhookUrl("prospectflow-importar"), {
         method: "POST",
         body: formData,
       });
       const texto = await resposta.text();
       let json = {};
 
       try {
         json = texto ? JSON.parse(texto) : {};
       } catch {
         throw new Error(texto || "O webhook não retornou um JSON válido.");
       }
 
       const retorno = normalizarResposta(json);
       if (!resposta.ok || retorno?.ok === false) {
         throw new Error(
           retorno?.mensagem ||
             retorno?.message ||
             "Erro ao importar o arquivo.",
         );
       }
 
       const importados =
         retorno?.importados ?? retorno?.inseridos ?? retorno?.quantidade ?? 0;
       const ignorados = retorno?.ignorados ?? retorno?.duplicados ?? 0;
       setResultadoImportacao(
         `Importação concluída: ${importados} incluído(s) e ${ignorados} ignorado(s).`,
       );
       await carregarLeads();
     } catch (e) {
       setResultadoImportacao(
         e.message || "Não foi possível importar o arquivo.",
       );
     } finally {
       setExecutando(null);
     }
   }


   async function importarWhatsApp() {
  if (!empresaId) {
    alert("Empresa não identificada.");
    return;
  }

  const confirmar = window.confirm(
    "Deseja importar os contatos do WhatsApp para a Central Comercial?",
  );

  if (!confirmar) return;

  try {
    setExecutando("IMPORTAR_WHATSAPP");
    setErro("");

    const resposta = await fetch(buildWebhookUrl("importar_zap"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        empresa_id: Number(empresaId),
      }),
    });

    const texto = await resposta.text();
    let json = {};

    try {
      json = texto ? JSON.parse(texto) : {};
    } catch {
      throw new Error(texto || "O webhook não retornou um JSON válido.");
    }

    const retorno = normalizarResposta(json);

    if (!resposta.ok || retorno?.ok === false) {
      throw new Error(
        retorno?.mensagem ||
          retorno?.message ||
          "Erro ao importar contatos do WhatsApp.",
      );
    }

    await carregarLeads();

    alert(
      retorno?.mensagem ||
        retorno?.message ||
        "Contatos do WhatsApp importados com sucesso.",
    );
  } catch (e) {
    alert(e.message || "Não foi possível importar os contatos do WhatsApp.");
  } finally {
    setExecutando(null);
  }
}



 
   function abrirEditarLead(lead) {
     setFormLead({
       ...leadVazio,
       ...lead,
     });
     setModalLead(true);
   }
 
   async function salvarLead() {
     if (!formLead.nome.trim()) {
       alert("Informe o nome do lead.");
       return;
     }
 
     try {
       setExecutando("SALVAR_LEAD");
       await chamarApi("SALVAR_LEAD", formLead);
       setModalLead(false);
       setFormLead(leadVazio);
       await carregarLeads();
     } catch (e) {
       alert(e.message || "Erro ao salvar o lead.");
     } finally {
       setExecutando(null);
     }
   }
 
   function abrirModalEnvio(lead) {
     if (!lead.proxima_mensagem_id) {
       alert("Não existe uma próxima mensagem ativa para este lead.");
       return;
     }
 
     if (lead.canal_preferido !== "WHATSAPP") {
       alert("O envio automático está disponível somente para WhatsApp.");
       return;
     }
 
     setModalEnvio(lead);
   }
 
   async function enviarMensagemCadencia() {
     const lead = modalEnvio;
     if (!lead) return;
 
     const mensagem = rascunhos[lead.id] ?? lead.mensagem_pronta ?? "";
 
     try {
       setExecutando(`ENVIO-${lead.id}`);
       await enviarMensagemWhatsApp({
         leadId: lead.id,
         telefone: lead.telefone,
         mensagem,
         tipoEnvio: "CADENCIA",
         mensagemId: lead.proxima_mensagem_id,
       });
       setModalEnvio(null);
       await carregarLeads();
     } catch (e) {
       alert(e.message || "Erro ao enviar a mensagem ao lead.");
     } finally {
       setExecutando(null);
     }
   }
 
   function abrirModalResposta(lead) {
     setTextoAcao("");
     setModalAcao({ tipo: "RESPOSTA", lead });
   }
 
   async function registrarResposta() {
     const lead = modalAcao?.lead;
     if (!lead) return;
 
     try {
       setExecutando(`RESPOSTA-${lead.id}`);
       await chamarApi("REGISTRAR_RESPOSTA", {
         lead_id: lead.id,
         canal: lead.canal_preferido,
         mensagem: textoAcao,
       });
       setModalAcao(null);
       setTextoAcao("");
       await carregarLeads();
     } catch (e) {
       alert(e.message || "Erro ao registrar a resposta.");
     } finally {
       setExecutando(null);
     }
   }
 
   function abrirModalMinhaResposta(lead) {
     setTextoAcao("");
     setModalAcao({ tipo: "MINHA_RESPOSTA", lead });
   }
 
   async function registrarMinhaResposta() {
     const lead = modalAcao?.lead;
     if (!lead) return;
 
     if (lead.canal_preferido !== "WHATSAPP") {
       alert("O envio automático está disponível somente para WhatsApp.");
       return;
     }
 
     try {
       setExecutando(`MINHA_RESPOSTA-${lead.id}`);
       await enviarMensagemWhatsApp({
         leadId: lead.id,
         telefone: lead.telefone,
         mensagem: textoAcao,
         tipoEnvio: "CONVERSA",
       });
       setModalAcao(null);
       setTextoAcao("");
       await carregarLeads();
     } catch (e) {
       alert(e.message || "Erro ao enviar a mensagem ao lead.");
     } finally {
       setExecutando(null);
     }
   }
 
   function abrirModalEncerramento(lead) {
     setTextoAcao("Prospecção encerrada sem conversão");
     setModalAcao({ tipo: "ENCERRAMENTO", lead });
   }
 
   async function encerrarLead() {
     const lead = modalAcao?.lead;
     if (!lead) return;
 
     try {
       setExecutando(`ENCERRAMENTO-${lead.id}`);
       await chamarApi("ENCERRAR_LEAD", {
         lead_id: lead.id,
         mensagem: textoAcao,
       });
       setModalAcao(null);
       setTextoAcao("");
       await carregarLeads();
     } catch (e) {
       alert(e.message || "Erro ao encerrar a prospecção.");
     } finally {
       setExecutando(null);
     }
   }
 
   function abrirModalBloqueio(lead) {
     setTextoAcao("Destinatário pediu para não receber mais mensagens");
     setModalAcao({ tipo: "BLOQUEIO", lead });
   }
 
   async function bloquearLead() {
     const lead = modalAcao?.lead;
     if (!lead) return;
 
     try {
       setExecutando(`BLOQUEIO-${lead.id}`);
       await chamarApi("BLOQUEAR_LEAD", {
         lead_id: lead.id,
         canal: lead.canal_preferido,
         motivo: textoAcao,
       });
       setModalAcao(null);
       setTextoAcao("");
       await carregarLeads();
     } catch (e) {
       alert(e.message || "Erro ao bloquear o lead.");
     } finally {
       setExecutando(null);
     }
   }
 
   function abrirModalConversao(lead) {
     setTextoAcao("Lead convertido em cliente");
     setModalAcao({ tipo: "CONVERSAO", lead });
   }
 
   async function converterLead() {
     const lead = modalAcao?.lead;
     if (!lead) return;
 
     try {
       setExecutando(`CONVERSAO-${lead.id}`);
       await chamarApi("CONVERTER_LEAD", {
         lead_id: lead.id,
         mensagem: textoAcao,
       });
       setModalAcao(null);
       setTextoAcao("");
       await carregarLeads();
     } catch (e) {
       alert(e.message || "Erro ao converter o lead.");
     } finally {
       setExecutando(null);
     }
   }
 
   async function abrirHistorico(lead) {
     try {
       setExecutando(`HISTORICO-${lead.id}`);
       const retorno = await chamarApi("HISTORICO", { lead_id: lead.id });
       setLeadHistorico(lead);
       setHistorico(Array.isArray(retorno?.dados) ? retorno.dados : []);
       setModalHistorico(true);
     } catch (e) {
       alert(e.message || "Erro ao consultar o histórico.");
     } finally {
       setExecutando(null);
     }
   }
 
   async function criarMensagensPadrao() {
     try {
       setExecutando("CRIAR_PADRAO");
       await chamarApi("CRIAR_MENSAGENS_PADRAO");
       await carregarMensagens();
     } catch (e) {
       alert(e.message || "Erro ao criar as mensagens padrão.");
     } finally {
       setExecutando(null);
     }
   }
 
   function abrirNovaMensagem() {
     const maiorOrdem = mensagens.reduce(
       (maior, item) => Math.max(maior, Number(item.ordem || 0)),
       0,
     );
     setFormMensagem({
       ...mensagemVazia,
       ordem: maiorOrdem + 1,
     });
     setModalMensagem(true);
   }
 
   function abrirEditarMensagem(mensagem) {
     setFormMensagem({
       ...mensagemVazia,
       ...mensagem,
     });
     setModalMensagem(true);
   }
 
   async function salvarMensagem() {
     if (!formMensagem.nome.trim() || !formMensagem.texto.trim()) {
       alert("Informe o nome e o texto da mensagem.");
       return;
     }
 
     try {
       setExecutando("SALVAR_MENSAGEM");
       await chamarApi("SALVAR_MENSAGEM", {
         ...formMensagem,
         ordem: Number(formMensagem.ordem),
         dias_apos_anterior: Number(formMensagem.dias_apos_anterior),
       });
       setModalMensagem(false);
       await carregarMensagens();
     } catch (e) {
       alert(e.message || "Erro ao salvar a mensagem.");
     } finally {
       setExecutando(null);
     }
   }
 
   return (
     <div id="prospectflow-page" className="pf-page">
       <div className="pf-shell">
         <header className="pf-header">
           <div className="absolute -right-16 -top-24 h-60 w-60 rounded-full bg-sky-400/10" />
           <div className="absolute -bottom-24 right-36 h-44 w-44 rounded-full bg-blue-300/10" />
 
           <div className="relative flex flex-wrap items-center justify-between gap-4">
             <div className="flex items-center gap-4">
               <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl shadow-inner ring-1 ring-white/20">
                 ↗
               </div>
               <div>
                 <div className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-sky-300">
                   Central comercial
                 </div>
                 <h1 className="text-2xl font-black tracking-tight">
                   ProspectFlow
                 </h1>
                 <p className="mt-1 text-sm font-medium text-slate-300">
                   Abra a fila, envie a mensagem indicada e registre o resultado.
                 </p>
               </div>
             </div>
 
             <div className="pf-header-actions">

                <button
                type="button"
                onClick={importarWhatsApp}
                disabled={executando === "IMPORTAR_WHATSAPP"}
                className="pf-import-button"
              >
                {executando === "IMPORTAR_WHATSAPP"
                  ? "Importando WhatsApp..."
                  : "◉ Importar WhatsApp"}
              </button>



               <button
                 type="button"
                 onClick={abrirImportacao}
                 className="pf-import-button"
               >
                 ⇧ Importar leads
               </button>
               <button
                 type="button"
                 onClick={abrirNovoLead}
                 className="pf-primary-button"
               >
                 <span className="text-lg leading-none">＋</span>
                 Cadastrar lead
               </button>
             </div>
           </div>
         </header>
 
         <main className="pf-main">
           <div className="pf-tabs">
             <button
               type="button"
               onClick={() => setAba("LEADS")}
               className={`pf-tab ${aba === "LEADS" ? "is-active" : ""}`}
             >
               <span>☷</span>
               Prospecção
             </button>
             <button
               type="button"
               onClick={() => setAba("MENSAGENS")}
               className={`pf-tab ${aba === "MENSAGENS" ? "is-active" : ""}`}
             >
               <span>✦</span>
               Mensagens da cadência
             </button>
           </div>
 
           {erro && <div className="pf-error">{erro}</div>}
 
           {aba === "LEADS" ? (
             <>
               <section className="pf-toolbar">
                 <div className="flex flex-wrap items-center justify-between gap-3">
                   <div className="pf-filter-list">
                     {filtros.map((item) => (
                       <button
                         key={item.id}
                         type="button"
                         onClick={() => setFiltro(item.id)}
                       className={`pf-filter-button ${filtro === item.id ? "is-active" : ""}`}
                      >
                         <span>{item.nome}</span>
                         <strong className="pf-filter-count">
                           {quantidadesFiltro[item.id] ||
                             (filtro === item.id ? leads.length : 0)}
                         </strong>
                      </button>
                     ))}
                   </div>
 
                   <div className="pf-search-row">
                     <div className="relative flex-1">
                       <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                         ⌕
                       </span>
                       <input
                         type="search"
                         value={busca}
                         onChange={(e) => setBusca(e.target.value)}
                         placeholder="Buscar por nome, empresa ou contato..."
                         className="pf-search-input"
                       />
                     </div>
                     <button
                       type="button"
                       onClick={() => carregarLeads()}
                       className="pf-refresh-button"
                     >
                       ↻ Atualizar
                     </button>
                   </div>
                 </div>
               </section>
 
               {carregando ? (
                 <div className="pf-loading">Carregando...</div>
               ) : leads.length === 0 ? (
                 <div className="pf-empty-state">
                   <div className="bg-gradient-to-r from-sky-50 to-blue-50 px-6 py-7 text-center">
                     <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm ring-1 ring-sky-100">
                       ↗
                     </div>
                     <div className="mt-4 text-lg font-black text-[#0F172A]">
                       {filtro === "HOJE"
                         ? "Sua fila de hoje está vazia"
                         : "Nenhum lead neste filtro"}
                     </div>
                     <div className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-500">
                       {filtro === "HOJE"
                         ? "Cadastre seu primeiro contato. O ProspectFlow escolherá a mensagem certa e organizará automaticamente o próximo retorno."
                         : "Tente outro filtro ou pesquise por um nome diferente."}
                     </div>
                   </div>
 
                   {filtro === "HOJE" && (
                     <div className="grid gap-px bg-slate-200 md:grid-cols-3">
                       {[
                         [
                           "1",
                           "Cadastre",
                           "Informe o contato e escolha o canal.",
                         ],
                         [
                           "2",
                           "Envie",
                           "A mensagem da etapa já aparece pronta.",
                         ],
                         ["3", "Confirme", "O próximo retorno será agendado."],
                       ].map(([numero, titulo, texto]) => (
                         <div key={numero} className="bg-white p-5 text-center">
                           <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#0F172A] text-xs font-black text-white">
                             {numero}
                           </div>
                           <div className="mt-3 text-sm font-black text-slate-800">
                             {titulo}
                           </div>
                           <div className="mt-1 text-xs leading-relaxed text-slate-500">
                             {texto}
                           </div>
                         </div>
                       ))}
                     </div>
                   )}
 
                   <div className="flex justify-center px-5 py-5">
                     <button
                       type="button"
                       onClick={abrirNovoLead}
                       className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-black text-white shadow-md shadow-sky-200 transition hover:bg-sky-700"
                     >
                       + Cadastrar primeiro lead
                     </button>
                   </div>
                 </div>
               ) : (
                 <section className="pf-commercial-workspace">
                   <aside className="pf-prospect-sidebar">
                     <div className="pf-prospect-sidebar-header">
                       <div>
                         <strong>Prospects</strong>
                         <span>{leads.length} nesta fila</span>
                       </div>
                       <span className="pf-prospect-total">{leads.length}</span>
                     </div>

                     <div className="pf-prospect-list">
                       {leads.map((lead) => {
                         const [statusNome] = statusVisual(lead.status);
                         const ativo =
                           String(leadSelecionado?.id) === String(lead.id);
                         const ultimaMensagem =
                           lead.ultima_interacao_mensagem ||
                           lead.mensagem_pronta ||
                           "Sem mensagem registrada";

                         return (
                           <button
                             key={lead.id}
                             type="button"
                             onClick={() => setLeadSelecionadoId(lead.id)}
                             onDoubleClick={() => abrirEditarLead(lead)}
                             className={`pf-prospect-item ${
                               ativo ? "is-active" : ""
                             }`}
                           >
                             <span className="pf-prospect-avatar">
                               {iniciaisLead(lead.nome)}
                             </span>
                             <span className="pf-prospect-copy">
                               <span className="pf-prospect-name-row">
                                 <strong>{lead.nome}</strong>
                                 <small>{statusNome}</small>
                               </span>
                               <span className="pf-prospect-company">
                                 {lead.empresa_nome ||
                                   lead.segmento ||
                                   lead.telefone ||
                                   "Contato sem empresa"}
                               </span>
                               <span className="pf-prospect-last-message">
                                 {ultimaMensagem}
                               </span>
                             </span>
                           </button>
                         );
                       })}
                     </div>
                   </aside>

                   <div className="pf-selected-pane">
                     {leads
                       .filter(
                         (lead) =>
                           String(lead.id) === String(leadSelecionado?.id),
                       )
                       .map((lead) => {
                         const [statusNome, statusClasse] = statusVisual(
                           lead.status,
                         );
                     const bloqueado =
                       lead.nao_contatar || lead.status === "BLOQUEADO";
                     const possuiMensagemEnviada =
                       Number(lead.ultima_cadencia_enviada || 0) > 0;
                     const aguardandoMinhaResposta =
                       lead.status === "AGUARDANDO_MINHA_RESPOSTA";
                    
 
                     const aguardandoCliente = [
                     "EM_CADENCIA",
                   "AGUARDANDO_CLIENTE",
                             ].includes(lead.status);
 
 
                     const emConversa =
                       aguardandoMinhaResposta || aguardandoCliente;
                     const podeRegistrarResposta =
                       possuiMensagemEnviada &&
                       ["EM_CADENCIA", "AGUARDANDO_CLIENTE"].includes(
                         lead.status,
                       );
                     const permiteCadencia =
                       !bloqueado &&
                       ["NOVO", "EM_CADENCIA"].includes(lead.status) &&
                       Boolean(lead.proxima_mensagem_id);
                     const canal = canalVisual(lead.canal_preferido);
 
                     return (
                       <article
                         key={lead.id}
                         data-canal={lead.canal_preferido}
                         data-bloqueado={bloqueado ? "true" : "false"}
                         className={`pf-lead-card ${
                           bloqueado
                             ? "border-red-200 ring-1 ring-red-100"
                             : "border-slate-200/90"
                         }`}
                       >
                         <div className="pf-lead-row">
                           <div className="pf-lead-info">
                             <div className="flex flex-wrap items-center gap-2">
                               <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F172A] text-[11px] font-black text-white shadow-sm">
                                 {iniciaisLead(lead.nome)}
                               </div>
                               <button
                                 type="button"
                                 onClick={() => abrirEditarLead(lead)}
                                 className="text-left text-sm font-black text-[#0F172A] hover:text-sky-700"
                               >
                                 {lead.nome}
                               </button>
                               <span
                                 className={`rounded-full px-2 py-1 text-[10px] font-black ${statusClasse}`}
                               >
                                 {statusNome}
                               </span>
                               <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                                 {lead.tipo_lead}
                               </span>
                             </div>
 
                             <div className="mt-3 text-xs font-semibold text-slate-500">
                               {lead.empresa_nome ||
                                 lead.segmento ||
                                 "Sem empresa/segmento"}
                             </div>
                             <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-xs text-slate-600">
                               <div>
                                 <span
                                   className={`mr-2 inline-flex rounded-full px-2 py-1 text-[10px] font-black ring-1 ${canal.classe}`}
                                 >
                                   {canal.icone} {canal.nome}
                                 </span>
                                 {lead.telefone ||
                                   lead.instagram ||
                                   lead.email ||
                                   "não informado"}
                               </div>
                               <div>
                                 Próximo contato:{" "}
                                 <strong>
                                   {dataBR(lead.proximo_contato_em)}
                                 </strong>
                               </div>
                               <div>
                                 Última mensagem enviada:{" "}
                                 <strong>
                                   {lead.ultima_cadencia_enviada || 0}
                                 </strong>
                               </div>
                             </div>
 
                             {bloqueado && (
                               <div className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-xs font-black text-red-700">
                                 Não enviar novas mensagens para este contato.
                               </div>
                             )}
                           </div>
 
                           <div className="pf-message-preview">
                             {permiteCadencia ? (
                               <>
                                 <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-100 bg-white/80 px-4 py-3">
                                   <div>
                                     <div className="text-[9px] font-black uppercase tracking-[0.16em] text-sky-600">
                                       Mensagem indicada agora
                                     </div>
                                     <div className="mt-1 flex items-center gap-2 text-sm font-black text-[#0F172A]">
                                       <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-[10px] text-white">
                                         {lead.proxima_cadencia}
                                       </span>
                                       {lead.proxima_mensagem_nome}
                                     </div>
                                   </div>
                                   <span className="rounded-lg bg-sky-100 px-2.5 py-1 text-[10px] font-black text-sky-700">
                                     pronta para enviar
                                   </span>
                                 </div>
                                 <div className="p-4">
                                   <p className="line-clamp-3 min-h-[60px] text-sm leading-relaxed text-slate-600">
                                     {rascunhos[lead.id] ??
                                       lead.mensagem_pronta ??
                                       "Mensagem não informada"}
                                   </p>
                                   <div className="mt-3 flex items-center justify-between border-t border-sky-100 pt-3 text-[10px] font-semibold text-slate-400">
                                     <span>Prévia da mensagem</span>
                                     <span>Editar no momento do envio</span>
                                   </div>
                                 </div>
                               </>
                             ) : emConversa ? (
                               <div
                                 className={`pf-conversation-state ${
                                   aguardandoMinhaResposta
                                     ? "is-my-turn"
                                     : "is-client-turn"
                                 }`}
                               >
                                 <div className="pf-conversation-title">
                                   {aguardandoMinhaResposta
                                     ? "O lead respondeu. Agora é a sua vez."
                                     : "Sua resposta foi registrada."}
                                 </div>
                                 <div className="pf-conversation-subtitle">
                                   {aguardandoMinhaResposta
                                     ? "Responda para manter a conversa avançando."
                                     : "Aguardando uma nova resposta do cliente."}
                                 </div>
                                 {lead.ultima_interacao_mensagem && (
                                   <div className="pf-last-message">
                                     <strong>
                                       {interacaoVisual(
                                         lead.ultima_interacao_tipo,
                                       )}
                                       :
                                     </strong>{" "}
                                     {lead.ultima_interacao_mensagem}
                                   </div>
                                 )}
                               </div>
                             ) : (
                               <div className="flex h-full min-h-32 items-center justify-center px-4 text-center text-xs font-bold text-slate-500">
                                 {bloqueado
                                   ? lead.motivo_bloqueio || "Contato bloqueado"
                                   : "Não existe mensagem pendente para este status."}
                               </div>
                             )}
                           </div>
 
                           <div className="pf-lead-actions">
                             {permiteCadencia && (
                               <>
                                 <button
                                   type="button"
                                   onClick={() => abrirModalEnvio(lead)}
                                   className={`flex items-center justify-between rounded-xl bg-gradient-to-r px-4 py-3.5 text-left text-sm font-black text-white shadow-md transition hover:brightness-105 ${canal.faixa}`}
                                 >
                                   <span>
                                     <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs">
                                       {canal.icone}
                                     </span>
                                     Prospectar agora
                                   </span>
                                   <span>→</span>
                                 </button>
                               </>
                             )}
 
                             {aguardandoMinhaResposta && (
                               <button
                                 type="button"
                                 onClick={() => abrirModalMinhaResposta(lead)}
                                 className="pf-action-primary pf-action-reply"
                               >
                                 ↗ Responder lead
                               </button>
                             )}
 
                            {/*} {!bloqueado && podeRegistrarResposta && (
                               <button
                                 type="button"
                                 onClick={() => abrirModalResposta(lead)}
                                 className="rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-xs font-black text-violet-700 hover:bg-violet-50"
                               >
                                 ↩ Registrar resposta do lead
                               </button>
                             )}*/}
 
                           {!bloqueado && aguardandoMinhaResposta && (
                               <button
                                 type="button"
                                 onClick={() => abrirModalConversao(lead)}
                                 className="rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-xs font-black text-emerald-700 hover:bg-emerald-50"
                               >
                                 ★ Virou cliente
                               </button>
                             )}
 
                             {!bloqueado && 
                               !["CONVERTIDO", "ENCERRADO"].includes(
                                 lead.status,
                               ) && (
                                 <button
                                   type="button"
                                   onClick={() => abrirModalEncerramento(lead)}
                                   className="pf-action-close"
                                 >
                                   × Desistir
                                 </button>
                               )}
 
                             <div className="grid grid-cols-2 gap-2">
                               <button
                                 type="button"
                                 onClick={() => abrirHistorico(lead)}
                                 className="rounded-lg px-2 py-2 text-[11px] font-black text-slate-500 hover:bg-white"
                               >
                                 Histórico
                               </button>
                               {!bloqueado && (
                                 <button
                                   type="button"
                                   onClick={() => abrirModalBloqueio(lead)}
                                   className="rounded-lg px-2 py-2 text-[11px] font-black text-red-500 hover:bg-red-50"
                                 >
                                   Não contatar
                                 </button>
                               )}
                             </div>
                           </div>
                         </div>
                       </article>
                     );
                       })}
                   </div>
                 </section>
               )}
             </>
           ) : (
             <section className="pf-messages-page">
               <div className="pf-section-header">
                 <div>
                   <h2 className="text-base font-black text-[#0F172A]">
                     Mensagens da cadência
                   </h2>
                   <p className="text-xs text-slate-500">
                     O sistema sempre oferece a próxima mensagem ativa da
                     sequência.
                   </p>
                 </div>
                 <div className="flex gap-2">
                   {mensagens.length === 0 && (
                     <button
                       type="button"
                       disabled={executando === "CRIAR_PADRAO"}
                       onClick={criarMensagensPadrao}
                       className="rounded-lg border border-sky-200 px-3 py-2 text-xs font-black text-sky-700"
                     >
                       Criar mensagens padrão
                     </button>
                   )}
                   <button
                     type="button"
                     onClick={abrirNovaMensagem}
                     className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-black text-white"
                   >
                     + Nova mensagem
                   </button>
                 </div>
               </div>
 
               <div className="pf-cadence-list">
                 {mensagens.map((mensagem) => (
                   <button
                     type="button"
                     key={mensagem.id}
                     onClick={() => abrirEditarMensagem(mensagem)}
                     className="pf-cadence-card"
                   >
                     <div className="flex flex-wrap items-center gap-2">
                       <span className="rounded-full bg-[#0F172A] px-2 py-1 text-[10px] font-black text-white">
                         Mensagem {mensagem.ordem}
                       </span>
                       <span className="text-sm font-black text-slate-800">
                         {mensagem.nome}
                       </span>
                       <span
                         className={`rounded-full px-2 py-1 text-[10px] font-black ${
                           mensagem.ativo
                             ? "bg-emerald-100 text-emerald-700"
                             : "bg-slate-100 text-slate-500"
                         }`}
                       >
                         {mensagem.ativo ? "Ativa" : "Inativa"}
                       </span>
                       <span className="text-xs font-bold text-slate-400">
                         {mensagem.ordem === 1
                           ? "Disponível imediatamente"
                           : `${mensagem.dias_apos_anterior} dias após a anterior`}
                       </span>
                     </div>
                     <p className="mt-3 text-sm leading-relaxed text-slate-600">
                       {mensagem.texto}
                     </p>
                   </button>
                 ))}
 
                 {!carregando && mensagens.length === 0 && (
                   <div className="rounded-xl border border-dashed border-slate-300 py-14 text-center text-sm font-bold text-slate-500">
                     Ainda não existem mensagens para esta empresa.
                   </div>
                 )}
               </div>
             </section>
           )}
         </main>
       </div>
 
       {modalEnvio && (
         <div className="pf-modal-overlay">
           <div className="pf-modal pf-modal-sm">
             <div className="pf-modal-header pf-modal-header-blue">
               <div className="flex items-start justify-between gap-4">
                 <div className="flex gap-3">
                   <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-lg ring-1 ring-white/20">
                     ✓
                   </div>
                   <div>
                     <h2 className="text-base font-black">Enviar mensagem</h2>
                     <p className="mt-1 text-xs leading-relaxed text-sky-100">
                       Revise o template e envie diretamente para o lead.
                     </p>
                   </div>
                 </div>
                 <button
                   type="button"
                   onClick={() => setModalEnvio(null)}
                   className="rounded-lg px-2 py-1 text-white/70 hover:bg-white/10 hover:text-white"
                 >
                   ✕
                 </button>
               </div>
             </div>
 
             <div className="pf-modal-body">
               <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                 <div>
                   <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                     Lead
                   </div>
                   <div className="mt-1 text-sm font-black text-slate-800">
                     {modalEnvio.nome}
                   </div>
                 </div>
                 <div className="text-right">
                   <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                     Cadência
                   </div>
                   <div className="mt-1 text-sm font-black text-sky-700">
                     Mensagem {modalEnvio.proxima_cadencia}
                   </div>
                 </div>
               </div>
 
               <div>
                 <div className="mb-2 flex items-center justify-between gap-2">
                   <label className="text-xs font-black text-slate-700">
                     Mensagem que será enviada
                   </label>
                   <span className="text-[10px] font-bold text-slate-400">
                     Você pode editar
                   </span>
                 </div>
                 <textarea
                   rows={6}
                   autoFocus
                   value={
                     rascunhos[modalEnvio.id] ?? modalEnvio.mensagem_pronta ?? ""
                   }
                   onChange={(e) =>
                     setRascunhos((atual) => ({
                       ...atual,
                       [modalEnvio.id]: e.target.value,
                     }))
                   }
                   className="w-full rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3 text-sm leading-relaxed text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                 />
               </div>
 
               <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold leading-relaxed text-blue-700">
                 A mensagem será enviada diretamente pelo ProspectFlow. O
                 histórico, a etapa da cadência e o status do lead serão
                 atualizados automaticamente.
               </div>
             </div>
 
             <div className="pf-modal-footer">
               <button
                 type="button"
                 onClick={() => setModalEnvio(null)}
                 className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600"
               >
                 Cancelar
               </button>
               <button
                 type="button"
                 disabled={
                   executando === `ENVIO-${modalEnvio.id}` ||
                   !(rascunhos[modalEnvio.id] ?? modalEnvio.mensagem_pronta ?? "").trim()
                 }
                 onClick={enviarMensagemCadencia}
                 className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-blue-200 disabled:opacity-50"
               >
                 {executando === `ENVIO-${modalEnvio.id}`
                   ? "Enviando..."
                   : "Enviar mensagem"}
               </button>
             </div>
           </div>
         </div>
       )}
 
       {modalAcao && (
         <div className="pf-modal-overlay">
           <div className="pf-modal pf-modal-sm">
             <div
               className={`pf-modal-header ${
                 modalAcao.tipo === "BLOQUEIO"
                   ? "pf-modal-header-red"
                   : modalAcao.tipo === "CONVERSAO"
                     ? "pf-modal-header-green"
                     : modalAcao.tipo === "ENCERRAMENTO"
                       ? "pf-modal-header-orange"
                       : modalAcao.tipo === "MINHA_RESPOSTA"
                         ? "pf-modal-header-blue"
                         : "pf-modal-header-purple"
               }`}
             >
               <div className="flex items-start justify-between gap-4">
                 <div>
                   <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/70">
                     {modalAcao.tipo === "BLOQUEIO"
                       ? "Proteção de contato"
                       : modalAcao.tipo === "CONVERSAO"
                         ? "Resultado comercial"
                         : modalAcao.tipo === "ENCERRAMENTO"
                           ? "Encerramento da oportunidade"
                           : modalAcao.tipo === "MINHA_RESPOSTA"
                             ? "Sua vez na conversa"
                             : "Retorno do lead"}
                   </div>
                   <h2 className="mt-1 text-base font-black">
                     {modalAcao.tipo === "BLOQUEIO"
                       ? "Não contatar novamente"
                       : modalAcao.tipo === "CONVERSAO"
                         ? "Marcar como cliente"
                         : modalAcao.tipo === "ENCERRAMENTO"
                           ? "Desistir desta prospecção"
                           : modalAcao.tipo === "MINHA_RESPOSTA"
                             ? "Responder lead"
                             : "Registrar resposta do lead"}
                   </h2>
                   <p className="mt-1 text-xs text-white/80">
                     {modalAcao.lead.nome}
                   </p>
                 </div>
                 <button
                   type="button"
                   onClick={() => setModalAcao(null)}
                   className="rounded-lg px-2 py-1 text-white/70 hover:bg-white/10 hover:text-white"
                 >
                   ✕
                 </button>
               </div>
             </div>
 
             <div className="pf-modal-body">
               <div>
                 <label className="text-xs font-black text-slate-600">
                   {modalAcao.tipo === "BLOQUEIO"
                     ? "Motivo do bloqueio"
                     : modalAcao.tipo === "CONVERSAO"
                       ? "Observação da conversão"
                       : modalAcao.tipo === "ENCERRAMENTO"
                         ? "Motivo do encerramento"
                           : modalAcao.tipo === "MINHA_RESPOSTA"
                             ? "Mensagem que será enviada ao lead"
                             : "O que o lead respondeu?"}
                 </label>
                 <textarea
                   rows={5}
                   autoFocus
                   value={textoAcao}
                   onChange={(e) => setTextoAcao(e.target.value)}
                   placeholder={
                     modalAcao.tipo === "BLOQUEIO"
                       ? "Informe por que este contato não deve receber mensagens..."
                       : modalAcao.tipo === "CONVERSAO"
                         ? "Registre uma observação sobre o novo cliente..."
                         : modalAcao.tipo === "ENCERRAMENTO"
                           ? "Informe por que decidiu desistir desta oportunidade..."
                           : modalAcao.tipo === "MINHA_RESPOSTA"
                             ? "Digite a mensagem que você enviará ao lead..."
                             : "Cole ou resuma a resposta recebida..."
                   }
                   className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700 outline-none focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                 />
               </div>
 
               {modalAcao.tipo === "BLOQUEIO" && (
                 <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold leading-relaxed text-red-700">
                   Esta ação interrompe a cadência, remove o próximo contato e
                   impede novos envios para este lead.
                 </div>
               )}
 
               {modalAcao.tipo === "MINHA_RESPOSTA" && (
                 <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold leading-relaxed text-blue-700">
                   A mensagem será enviada diretamente pelo ProspectFlow e o
                   atendimento será atualizado automaticamente.
                 </div>
               )}
             </div>
 
             <div className="pf-modal-footer">
               <button
                 type="button"
                 onClick={() => setModalAcao(null)}
                 className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600"
               >
                 Cancelar
               </button>
               <button
                 type="button"
                 disabled={!textoAcao.trim() || Boolean(executando)}
                 onClick={
                   modalAcao.tipo === "BLOQUEIO"
                     ? bloquearLead
                     : modalAcao.tipo === "CONVERSAO"
                       ? converterLead
                       : modalAcao.tipo === "ENCERRAMENTO"
                         ? encerrarLead
                         : modalAcao.tipo === "MINHA_RESPOSTA"
                           ? registrarMinhaResposta
                           : registrarResposta
                 }
                 className={`rounded-xl px-5 py-2.5 text-xs font-black text-white shadow-md disabled:opacity-50 ${
                   modalAcao.tipo === "BLOQUEIO"
                     ? "bg-red-600 shadow-red-200"
                     : modalAcao.tipo === "CONVERSAO"
                       ? "bg-emerald-600 shadow-emerald-200"
                       : modalAcao.tipo === "ENCERRAMENTO"
                         ? "bg-orange-600 shadow-orange-200"
                         : modalAcao.tipo === "MINHA_RESPOSTA"
                           ? "bg-blue-600 shadow-blue-200"
                           : "bg-violet-600 shadow-violet-200"
                 }`}
               >
                 {modalAcao.tipo === "BLOQUEIO"
                   ? "Bloquear novos contatos"
                   : modalAcao.tipo === "CONVERSAO"
                     ? "Confirmar novo cliente"
                     : modalAcao.tipo === "ENCERRAMENTO"
                       ? "Confirmar desistência"
                       : modalAcao.tipo === "MINHA_RESPOSTA"
                         ? executando ===
                           `MINHA_RESPOSTA-${modalAcao.lead.id}`
                           ? "Enviando..."
                           : "Enviar mensagem"
                         : "Salvar resposta do lead"}
               </button>
             </div>
           </div>
         </div>
       )}
 
       {modalImportacao && (
         <div className="pf-modal-overlay">
           <div className="pf-modal pf-modal-md">
             <div className="pf-modal-titlebar">
               <div>
                 <h2>Importar leads ou clientes</h2>
                 <p>Envie uma planilha CSV, XLS ou XLSX para o ProspectFlow.</p>
               </div>
               <button type="button" onClick={() => setModalImportacao(false)}>
                 ✕
               </button>
             </div>
 
             <div className="pf-modal-body pf-import-body">
               <div className="pf-import-type">
                 <button
                   type="button"
                   className={tipoImportacao === "LEADS" ? "is-active" : ""}
                   onClick={() => setTipoImportacao("LEADS")}
                 >
                   <strong>Leads para prospectar</strong>
                   <span>Entram como novos e recebem a mensagem 1.</span>
                 </button>
                 <button
                   type="button"
                   className={tipoImportacao === "CLIENTES" ? "is-active" : ""}
                   onClick={() => setTipoImportacao("CLIENTES")}
                 >
                   <strong>Clientes existentes</strong>
                   <span>Entram como convertidos e não recebem prospecção.</span>
                 </button>
               </div>
 
               <label className="pf-file-picker">
                 <span className="pf-file-icon">⇧</span>
                 <strong>
                   {arquivoImportacao
                     ? arquivoImportacao.name
                     : "Selecionar planilha"}
                 </strong>
                 <small>CSV, XLS ou XLSX</small>
                 <input
                   type="file"
                   accept=".csv,.xls,.xlsx"
                   onChange={(e) => {
                     setArquivoImportacao(e.target.files?.[0] || null);
                     setResultadoImportacao("");
                   }}
                 />
               </label>
 
               <div className="pf-import-rules">
                 <strong>Campos mínimos</strong>
                 <p>
                   A coluna <b>nome</b> é obrigatória. Cada linha também precisa
                   ter telefone, e-mail ou Instagram. Os demais campos são
                   opcionais.
                 </p>
                 <button type="button" onClick={baixarModeloImportacao}>
                   ↓ Baixar modelo CSV
                 </button>
               </div>
 
               {resultadoImportacao && (
                 <div className="pf-import-result">{resultadoImportacao}</div>
               )}
             </div>
 
             <div className="pf-modal-footer">
               <button type="button" onClick={() => setModalImportacao(false)}>
                 Fechar
               </button>
               <button
                 type="button"
                 disabled={
                   !arquivoImportacao || executando === "IMPORTAR_CONTATOS"
                 }
                 onClick={importarContatos}
               >
                 {executando === "IMPORTAR_CONTATOS"
                   ? "Importando..."
                   : "Importar arquivo"}
               </button>
             </div>
           </div>
         </div>
       )}
 
       {modalLead && (
         <div className="pf-modal-overlay">
           <div className="pf-modal pf-modal-lg">
             <div className="pf-modal-titlebar">
               <div>
                 <h2 className="text-base font-black text-[#0F172A]">
                   {formLead.id ? "Editar lead" : "Novo lead"}
                 </h2>
                 <p className="text-xs text-slate-500">
                   Pessoa física ou jurídica
                 </p>
               </div>
               <button
                 type="button"
                 onClick={() => setModalLead(false)}
                 className="rounded-lg px-3 py-2 text-sm font-black text-slate-500 hover:bg-slate-100"
               >
                 ✕
               </button>
             </div>
 
             <div className="pf-form-grid">
               <Campo label="Tipo de lead">
                 <select
                   value={formLead.tipo_lead}
                   onChange={(e) =>
                     setFormLead((f) => ({ ...f, tipo_lead: e.target.value }))
                   }
                   className="campo"
                 >
                   <option value="PF">Pessoa física</option>
                   <option value="PJ">Pessoa jurídica</option>
                 </select>
               </Campo>
 
               <Campo label="Nome *">
                 <input
                   value={formLead.nome}
                   onChange={(e) =>
                     setFormLead((f) => ({ ...f, nome: e.target.value }))
                   }
                   className="campo"
                 />
               </Campo>
 
               <Campo label="Empresa">
                 <input
                   value={formLead.empresa_nome || ""}
                   onChange={(e) =>
                     setFormLead((f) => ({ ...f, empresa_nome: e.target.value }))
                   }
                   className="campo"
                 />
               </Campo>
 
               <Campo label="Segmento">
                 <input
                   value={formLead.segmento || ""}
                   onChange={(e) =>
                     setFormLead((f) => ({ ...f, segmento: e.target.value }))
                   }
                   className="campo"
                 />
               </Campo>
 
               <Campo label="Cidade">
                 <input
                   value={formLead.cidade || ""}
                   onChange={(e) =>
                     setFormLead((f) => ({ ...f, cidade: e.target.value }))
                   }
                   className="campo"
                 />
               </Campo>
 
               <Campo label="Canal preferido">
                 <select
                   value={formLead.canal_preferido}
                   onChange={(e) =>
                     setFormLead((f) => ({
                       ...f,
                       canal_preferido: e.target.value,
                     }))
                   }
                   className="campo"
                 >
                   <option value="WHATSAPP">WhatsApp</option>
                   <option value="INSTAGRAM">Instagram</option>
                   <option value="EMAIL">E-mail</option>
                   <option value="TELEFONE">Telefone</option>
                 </select>
               </Campo>
 
               <Campo label="Telefone">
                 <input
                   value={formLead.telefone || ""}
                   onChange={(e) =>
                     setFormLead((f) => ({ ...f, telefone: e.target.value }))
                   }
                   className="campo"
                 />
               </Campo>
 
               <Campo label="Instagram">
                 <input
                   value={formLead.instagram || ""}
                   onChange={(e) =>
                     setFormLead((f) => ({ ...f, instagram: e.target.value }))
                   }
                   placeholder="@usuario"
                   className="campo"
                 />
               </Campo>
 
               <Campo label="E-mail">
                 <input
                   type="email"
                   value={formLead.email || ""}
                   onChange={(e) =>
                     setFormLead((f) => ({ ...f, email: e.target.value }))
                   }
                   className="campo"
                 />
               </Campo>
 
               <Campo label="Origem">
                 <input
                   value={formLead.origem || ""}
                   onChange={(e) =>
                     setFormLead((f) => ({ ...f, origem: e.target.value }))
                   }
                   placeholder="Instagram, indicação, evento..."
                   className="campo"
                 />
               </Campo>
 
               <div className="md:col-span-2">
                 <Campo label="Observações">
                   <textarea
                     rows={3}
                     value={formLead.observacoes || ""}
                     onChange={(e) =>
                       setFormLead((f) => ({
                         ...f,
                         observacoes: e.target.value,
                       }))
                     }
                     className="campo"
                   />
                 </Campo>
               </div>
             </div>
 
             <div className="pf-modal-footer">
               <button
                 type="button"
                 onClick={() => setModalLead(false)}
                 className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-black text-slate-600"
               >
                 Cancelar
               </button>
               <button
                 type="button"
                 disabled={executando === "SALVAR_LEAD"}
                 onClick={salvarLead}
                 className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
               >
                 Salvar lead
               </button>
             </div>
           </div>
         </div>
       )}
 
       {modalMensagem && (
         <div className="pf-modal-overlay">
           <div className="pf-modal pf-modal-md">
             <div className="pf-modal-titlebar">
               <div>
                 <h2 className="text-base font-black text-[#0F172A]">
                   {formMensagem.id ? "Editar mensagem" : "Nova mensagem"}
                 </h2>
                 <p className="text-xs text-slate-500">
                   Variáveis: {"{{nome}}"}, {"{{empresa}}"}, {"{{segmento}}"},{" "}
                   {"{{cidade}}"}
                 </p>
               </div>
               <button
                 type="button"
                 onClick={() => setModalMensagem(false)}
                 className="rounded-lg px-3 py-2 text-sm font-black text-slate-500 hover:bg-slate-100"
               >
                 ✕
               </button>
             </div>
 
             <div className="pf-form-grid">
               <Campo label="Ordem">
                 <input
                   type="number"
                   min="1"
                   value={formMensagem.ordem}
                   onChange={(e) =>
                     setFormMensagem((f) => ({ ...f, ordem: e.target.value }))
                   }
                   className="campo"
                 />
               </Campo>
 
               <Campo label="Dias depois da mensagem anterior">
                 <input
                   type="number"
                   min="0"
                   value={formMensagem.dias_apos_anterior}
                   onChange={(e) =>
                     setFormMensagem((f) => ({
                       ...f,
                       dias_apos_anterior: e.target.value,
                     }))
                   }
                   className="campo"
                 />
               </Campo>
 
               <div className="md:col-span-2">
                 <Campo label="Nome">
                   <input
                     value={formMensagem.nome}
                     onChange={(e) =>
                       setFormMensagem((f) => ({ ...f, nome: e.target.value }))
                     }
                     className="campo"
                   />
                 </Campo>
               </div>
 
               <div className="md:col-span-2">
                 <Campo label="Texto">
                   <textarea
                     rows={6}
                     value={formMensagem.texto}
                     onChange={(e) =>
                       setFormMensagem((f) => ({ ...f, texto: e.target.value }))
                     }
                     className="campo"
                   />
                 </Campo>
               </div>
 
               <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                 <input
                   type="checkbox"
                   checked={Boolean(formMensagem.ativo)}
                   onChange={(e) =>
                     setFormMensagem((f) => ({ ...f, ativo: e.target.checked }))
                   }
                 />
                 Mensagem ativa
               </label>
             </div>
 
             <div className="pf-modal-footer">
               <button
                 type="button"
                 onClick={() => setModalMensagem(false)}
                 className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-black text-slate-600"
               >
                 Cancelar
               </button>
               <button
                 type="button"
                 disabled={executando === "SALVAR_MENSAGEM"}
                 onClick={salvarMensagem}
                 className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
               >
                 Salvar mensagem
               </button>
             </div>
           </div>
         </div>
       )}
 
       {modalHistorico && leadHistorico && (
         <div className="pf-modal-overlay">
           <div className="pf-modal pf-modal-history">
             <div className="pf-modal-titlebar pf-history-titlebar">
               <div>
                 <div className="pf-history-contact">
                   <span className="pf-history-avatar">
                     {iniciaisLead(leadHistorico.nome)}
                   </span>
                   <div>
                     <h2>{leadHistorico.nome}</h2>
                     <p>
                       {historico.length} interações
                       {leadHistorico.telefone
                         ? ` · ${leadHistorico.telefone}`
                         : ""}
                     </p>
                   </div>
                 </div>
               </div>
               <div className="pf-history-title-actions">
                 <span className="pf-history-channel">
                   ● {canalVisual(leadHistorico.canal_preferido).nome}
                 </span>
                 <button
                   type="button"
                   onClick={() => setModalHistorico(false)}
                   aria-label="Fechar histórico"
                 >
                   ✕
                 </button>
               </div>
             </div>
 
             <div className="pf-modal-body pf-history-list">
               {historico.map((item) => {
                 const autor = interacaoVisual(item.tipo);
                 const enviadoPorMim = autor === "Você";
                 const mensagemDoLead = autor === "Lead";

                 return (
                   <div
                     key={item.id}
                     className={`pf-chat-row ${
                       enviadoPorMim
                         ? "is-mine"
                         : mensagemDoLead
                           ? "is-lead"
                           : "is-system"
                     }`}
                   >
                     <div className="pf-chat-bubble">
                       <div className="pf-chat-meta">
                         <strong>
                           {autor}
                           {item.cadencia_ordem
                             ? ` · Mensagem ${item.cadencia_ordem}`
                             : ""}
                         </strong>
                         <span>{dataHoraBR(item.created_at)}</span>
                       </div>
                       <p>{item.mensagem || "Sem observação"}</p>
                     </div>
                   </div>
                 );
               })}
 
               {historico.length === 0 && (
                 <div className="py-12 text-center text-sm font-bold text-slate-400">
                   Nenhuma interação registrada.
                 </div>
               )}
             </div>
           </div>
         </div>
       )}
 
       <style>{`
         #prospectflow-page, #prospectflow-page * { box-sizing: border-box; }
         #prospectflow-page button, #prospectflow-page input,
         #prospectflow-page select, #prospectflow-page textarea { font: inherit; }
         #prospectflow-page button { cursor: pointer; }
         #prospectflow-page button:disabled { cursor: not-allowed; opacity: .55; }
 
         .pf-page {
           min-height: 100%; padding: 24px 22px 48px; background: #f5f7fa;
           color: #0f172a; font-family: Inter, ui-sans-serif, system-ui, -apple-system,
           BlinkMacSystemFont, "Segoe UI", sans-serif;
         }
         .pf-shell { width: 100%; max-width: 1680px; margin: 0 auto; }
         .pf-header {
           position: relative; display: flex; align-items: center; justify-content: space-between;
           min-height: 72px; margin-bottom: 14px; overflow: hidden;
         }
         .pf-header > div[class*="absolute"] { display: none; }
         .pf-header > div:last-child { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
         .pf-header > div:last-child > div { display: flex; align-items: center; gap: 13px; }
         .pf-header > div:last-child > div > div:first-child {
           display: flex; width: 46px; height: 46px; align-items: center; justify-content: center;
           border-radius: 12px; background: #dbeafe; color: #1d4ed8; font-size: 23px; font-weight: 900;
         }
         .pf-header h1 { margin: 1px 0 0; color: #0b1834; font-size: 25px; line-height: 1.1; font-weight: 900; letter-spacing: -.025em; }
         .pf-header h1 + p { margin: 5px 0 0; color: #64748b; font-size: 13px; font-weight: 500; }
         .pf-header h1 ~ * { max-width: 720px; }
         .pf-header h1, .pf-header p { display: block; }
         .pf-header h1::before { content: none; }
         .pf-header div[class*="uppercase"] { color: #2563eb; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .12em; }
         .pf-primary-button {
           display: inline-flex; align-items: center; gap: 7px; flex: 0 0 auto;
           border: 0; border-radius: 9px; padding: 10px 15px; background: #2563eb;
           color: #fff; font-size: 13px; font-weight: 800; box-shadow: 0 5px 14px rgba(37,99,235,.18);
         }
         .pf-primary-button:hover { background: #1d4ed8; transform: translateY(-1px); }
         .pf-header-actions { display: flex; align-items: center; gap: 8px; }
         .pf-import-button {
           display: inline-flex; align-items: center; gap: 7px; border: 1px solid #bfd0e4;
           border-radius: 9px; padding: 10px 14px; background: #fff; color: #315b86;
           font-size: 12px; font-weight: 800; box-shadow: 0 2px 6px rgba(15,23,42,.04);
         }
         .pf-import-button:hover { border-color: #60a5fa; background: #eff6ff; color: #1d4ed8; }
 
         .pf-main { display: flex; flex-direction: column; gap: 14px; }
         .pf-tabs {
           display: inline-flex; align-self: flex-start; gap: 4px; padding: 4px;
           border: 1px solid #dbe2ea; border-radius: 10px; background: #fff;
         }
         .pf-tab {
           display: inline-flex; align-items: center; gap: 7px; border: 0; border-radius: 7px;
           padding: 8px 13px; background: transparent; color: #64748b; font-size: 12px; font-weight: 800;
         }
         .pf-tab:hover { background: #f1f5f9; color: #0f172a; }
         .pf-tab.is-active { background: #0f172a; color: #fff; box-shadow: 0 2px 6px rgba(15,23,42,.16); }
         .pf-error { border: 1px solid #fecaca; border-radius: 9px; padding: 10px 14px; background: #fef2f2; color: #b91c1c; font-size: 12px; font-weight: 700; }
 
         .pf-toolbar {
           padding: 14px 15px; border-radius: 10px; background: #425f80; color: #fff;
           box-shadow: 0 2px 6px rgba(15,23,42,.07);
         }
         .pf-toolbar > div { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
         .pf-filter-list { display: flex; flex-wrap: wrap; gap: 5px; }
         .pf-filter-button { display: inline-flex; align-items: center; gap: 6px; border: 1px solid transparent; border-radius: 7px; padding: 7px 9px; background: rgba(255,255,255,.09); color: #e8eef6; font-size: 11px; font-weight: 800; }
         .pf-filter-button:hover { background: rgba(255,255,255,.16); }
         .pf-filter-button.is-active { border-color: #bfdbfe; background: #fff; color: #1e4976; }
         .pf-filter-count { display: inline-flex; min-width: 19px; height: 19px; align-items: center; justify-content: center; border-radius: 999px; padding: 0 6px; background: rgba(255,255,255,.16); color: #fff; font-size: 9px; line-height: 1; font-weight: 900; }
         .pf-filter-button.is-active .pf-filter-count { background: #dbeafe; color: #1d4ed8; }
         .pf-search-row { display: flex; width: min(530px, 48%); align-items: center; gap: 8px; }
         .pf-search-row > div { position: relative; flex: 1; }
         .pf-search-row span { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: #64748b; }
         .pf-search-input { width: 100%; height: 36px; border: 1px solid #d8e0ea; border-radius: 7px; padding: 0 11px 0 32px; background: #fff; color: #1e293b; font-size: 12px; outline: none; }
         .pf-search-input:focus { border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(96,165,250,.18); }
         .pf-refresh-button { height: 36px; border: 1px solid rgba(255,255,255,.4); border-radius: 7px; padding: 0 11px; background: rgba(255,255,255,.12); color: #fff; font-size: 11px; font-weight: 800; }
 
         .pf-loading { border: 1px solid #dbe2ea; border-radius: 10px; padding: 55px 20px; background: #fff; color: #64748b; text-align: center; font-size: 13px; font-weight: 700; }
         .pf-empty-state { overflow: hidden; border: 1px solid #dbe2ea; border-radius: 10px; background: #fff; box-shadow: 0 2px 6px rgba(15,23,42,.035); }
         .pf-empty-state > div:first-child { padding: 30px 20px 24px; background: linear-gradient(135deg,#eff6ff,#f8fafc); text-align: center; }
         .pf-empty-state > div:first-child > div:first-child { display: flex; width: 50px; height: 50px; margin: auto; align-items: center; justify-content: center; border: 1px solid #dbeafe; border-radius: 13px; background: #fff; color: #2563eb; font-size: 23px; }
         .pf-empty-state > div:first-child > div:nth-child(2) { margin-top: 13px; font-size: 18px; font-weight: 900; }
         .pf-empty-state > div:first-child > div:nth-child(3) { max-width: 620px; margin: 7px auto 0; color: #64748b; font-size: 12px; line-height: 1.6; }
         .pf-empty-state > div:nth-child(2):not(:last-child) { display: grid; grid-template-columns: repeat(3,1fr); gap: 1px; background: #e2e8f0; }
         .pf-empty-state > div:nth-child(2):not(:last-child) > div { padding: 18px; background: #fff; text-align: center; }
         .pf-empty-state > div:nth-child(2):not(:last-child) > div > div:first-child { display: flex; width: 27px; height: 27px; margin: auto; align-items: center; justify-content: center; border-radius: 50%; background: #0f172a; color: #fff; font-size: 11px; font-weight: 900; }
         .pf-empty-state > div:nth-child(2):not(:last-child) > div > div:nth-child(2) { margin-top: 8px; font-size: 12px; font-weight: 900; }
         .pf-empty-state > div:nth-child(2):not(:last-child) > div > div:nth-child(3) { margin-top: 4px; color: #64748b; font-size: 11px; }
         .pf-empty-state > div:last-child { display: flex; justify-content: center; padding: 16px; }
         .pf-empty-state > div:last-child button { border: 0; border-radius: 8px; padding: 10px 15px; background: #2563eb; color: #fff; font-size: 12px; font-weight: 800; }
 
         .pf-commercial-workspace {
           display: grid; grid-template-columns: 310px minmax(0,1fr); min-height: 535px;
           overflow: hidden; border: 1px solid #dbe2ea; border-radius: 11px;
           background: #fff; box-shadow: 0 5px 18px rgba(15,23,42,.06);
         }
         .pf-prospect-sidebar { display: flex; min-width: 0; flex-direction: column; border-right: 1px solid #dbe2ea; background: #f8fafc; }
         .pf-prospect-sidebar-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 14px; border-bottom: 1px solid #dbe2ea; background: #fff; }
         .pf-prospect-sidebar-header > div { display: flex; min-width: 0; flex-direction: column; }
         .pf-prospect-sidebar-header strong { color: #0f172a; font-size: 13px; font-weight: 900; }
         .pf-prospect-sidebar-header span:not(.pf-prospect-total) { margin-top: 2px; color: #94a3b8; font-size: 9px; font-weight: 700; }
         .pf-prospect-total { display: inline-flex; min-width: 25px; height: 25px; align-items: center; justify-content: center; border-radius: 999px; padding: 0 7px; background: #dbeafe; color: #1d4ed8; font-size: 10px; font-weight: 900; }
         .pf-prospect-list { flex: 1; max-height: 610px; overflow-y: auto; padding: 5px; }
         .pf-prospect-item { display: grid; width: 100%; grid-template-columns: 36px minmax(0,1fr); gap: 9px; align-items: center; border: 0; border-bottom: 1px solid #e2e8f0; border-radius: 7px; padding: 9px 8px; background: transparent; color: #334155; text-align: left; transition: background .15s ease, box-shadow .15s ease; }
         .pf-prospect-item:hover { background: #eef4fb; }
         .pf-prospect-item.is-active { background: #e8f1ff; box-shadow: inset 3px 0 #2563eb; }
         .pf-prospect-avatar { display: inline-flex; width: 36px; height: 36px; align-items: center; justify-content: center; border-radius: 50%; background: #153b67; color: #fff; font-size: 9px; font-weight: 900; }
         .pf-prospect-item.is-active .pf-prospect-avatar { background: #2563eb; }
         .pf-prospect-copy { display: block; min-width: 0; }
         .pf-prospect-name-row { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 7px; }
         .pf-prospect-name-row strong { overflow: hidden; color: #0f172a; font-size: 11px; font-weight: 900; text-overflow: ellipsis; white-space: nowrap; }
         .pf-prospect-name-row small { flex: 0 0 auto; border-radius: 999px; padding: 2px 5px; background: #e2e8f0; color: #64748b; font-size: 7px; font-weight: 900; }
         .pf-prospect-item.is-active .pf-prospect-name-row small { background: #bfdbfe; color: #1d4ed8; }
         .pf-prospect-company, .pf-prospect-last-message { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
         .pf-prospect-company { margin-top: 2px; color: #64748b; font-size: 9px; font-weight: 700; }
         .pf-prospect-last-message { margin-top: 4px; color: #94a3b8; font-size: 9px; }
         .pf-selected-pane { min-width: 0; overflow-y: auto; padding: 10px; background: #f4f7fb; }
         .pf-selected-pane .pf-lead-card { min-height: 100%; }
         .pf-selected-pane .pf-lead-card > div { grid-template-columns: minmax(220px,.72fr) minmax(300px,1.28fr); }
         .pf-selected-pane .pf-lead-actions { grid-column: 1 / -1; flex-direction: row; flex-wrap: wrap; padding: 10px 0 0; border-top: 1px solid #e2e8f0; border-left: 0; }
         .pf-selected-pane .pf-lead-actions button { width: auto; min-width: 125px; }
         .pf-selected-pane .pf-lead-actions > div { display: flex; }
         .pf-lead-list { display: grid; grid-template-columns: 1fr; gap: 7px; }
         .pf-lead-card { overflow: hidden; border: 1px solid #dbe2ea; border-left: 4px solid #3b82f6; border-radius: 9px; background: #fff; box-shadow: 0 1px 4px rgba(15,23,42,.04); transition: border-color .16s ease, box-shadow .16s ease; }
         .pf-lead-card:hover { border-color: #bfdbfe; box-shadow: 0 4px 12px rgba(15,23,42,.07); }
         .pf-lead-card[data-canal="WHATSAPP"] { border-left-color: #16a34a; }
         .pf-lead-card[data-canal="INSTAGRAM"] { border-left-color: #db2777; }
         .pf-lead-card[data-canal="EMAIL"] { border-left-color: #2563eb; }
         .pf-lead-card[data-canal="TELEFONE"] { border-left-color: #7c3aed; }
         .pf-lead-card[data-bloqueado="true"] { border-color: #fecaca; border-left-color: #dc2626; background: #fffafa; }
         .pf-lead-card > div { display: grid; grid-template-columns: minmax(235px,.78fr) minmax(330px,1.45fr) minmax(175px,.58fr); gap: 12px; align-items: stretch; padding: 11px 12px; }
         .pf-lead-info > div:first-child { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
         .pf-lead-info > div:first-child > div { display: flex; width: 35px; height: 35px; align-items: center; justify-content: center; border-radius: 9px; background: #0f172a; color: #fff; font-size: 10px; font-weight: 900; }
         .pf-lead-info > div:first-child > button { border: 0; padding: 0; background: transparent; color: #0f172a; font-size: 13px; font-weight: 900; }
         .pf-lead-info > div:first-child > span { border-radius: 999px; padding: 4px 7px; background: #e8eef6; color: #475569; font-size: 9px; font-weight: 900; }
         .pf-lead-info > div:nth-child(2) { margin-top: 7px; color: #64748b; font-size: 11px; font-weight: 700; }
         .pf-lead-info > div:nth-child(3) { margin-top: 7px; padding-top: 7px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 10px; line-height: 1.65; }
         .pf-lead-info > div:nth-child(3) span { display: inline-flex; margin-right: 5px; border-radius: 999px; padding: 2px 6px; background: #eef2ff; color: #334155; font-size: 9px; font-weight: 800; }
         .pf-message-preview { overflow: hidden; border: 1px solid #bfdbfe; border-radius: 9px; background: #eff6ff; }
         .pf-message-preview > div:first-child { display: flex; align-items: center; justify-content: space-between; gap: 9px; border-bottom: 1px solid #dbeafe; padding: 10px 12px; background: rgba(255,255,255,.72); }
         .pf-message-preview div[class*="uppercase"] { color: #2563eb; font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: .12em; }
         .pf-message-preview div[class*="text-sm"] { margin-top: 3px; color: #0f172a; font-size: 12px; font-weight: 900; }
         .pf-message-preview div[class*="text-sm"] span { display: inline-flex; width: 21px; height: 21px; margin-right: 6px; align-items: center; justify-content: center; border-radius: 50%; background: #2563eb; color: #fff; font-size: 9px; }
         .pf-message-preview > div:nth-child(2) { padding: 11px 12px; }
         .pf-message-preview p { min-height: 42px; margin: 0; overflow: hidden; color: #475569; font-size: 11px; line-height: 1.5; }
         .pf-message-preview > div:nth-child(2) > div { display: flex; justify-content: space-between; margin-top: 9px; padding-top: 8px; border-top: 1px solid #dbeafe; color: #94a3b8; font-size: 9px; }
         .pf-message-preview > .pf-conversation-state {
           display: flex; min-height: 112px; flex-direction: column; align-items: flex-start;
           justify-content: center; border: 0; padding: 13px; background: #f8fafc;
         }
         .pf-conversation-state.is-my-turn { border-left: 4px solid #7c3aed; background: #f5f3ff; }
         .pf-conversation-state.is-client-turn { border-left: 4px solid #2563eb; background: #eff6ff; }
         .pf-conversation-title { color: #1e293b; font-size: 12px; font-weight: 900; }
         .pf-conversation-subtitle { margin-top: 4px; color: #64748b; font-size: 10px; line-height: 1.45; }
         .pf-last-message { width: 100%; margin-top: 11px; overflow: hidden; border: 1px solid #dbe2ea; border-radius: 7px; padding: 8px 9px; background: rgba(255,255,255,.8); color: #475569; font-size: 10px; line-height: 1.45; text-overflow: ellipsis; }
         .pf-lead-actions { display: flex; min-width: 0; flex-direction: column; justify-content: center; gap: 6px; padding-left: 12px; border-left: 1px solid #e2e8f0; }
         .pf-lead-actions button { width: 100%; border: 1px solid #dbe2ea; border-radius: 7px; padding: 7px 9px; background: #fff; color: #475569; font-size: 10px; font-weight: 800; text-align: center; }
         .pf-lead-actions > button:first-child { border-color: #2563eb; background: #2563eb; color: #fff; font-size: 10px; }
         .pf-lead-actions > div { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
         .pf-lead-actions .pf-action-reply { border-color: #7c3aed; background: #7c3aed; color: #fff; }
         .pf-lead-actions .pf-action-close { color: #b45309; }
 
         .pf-messages-page { overflow: hidden; border: 1px solid #dbe2ea; border-radius: 10px; background: #fff; }
         .pf-section-header { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 15px; border-bottom: 1px solid #e2e8f0; }
         .pf-section-header h2 { margin: 0; font-size: 15px; font-weight: 900; }
         .pf-section-header p { margin: 4px 0 0; color: #64748b; font-size: 11px; }
         .pf-section-header > div:last-child { display: flex; gap: 7px; }
         .pf-section-header button { border: 1px solid #bfdbfe; border-radius: 7px; padding: 8px 11px; background: #fff; color: #1d4ed8; font-size: 11px; font-weight: 800; }
         .pf-section-header button:last-child { border-color: #2563eb; background: #2563eb; color: #fff; }
         .pf-cadence-list { display: grid; gap: 9px; padding: 14px; }
         .pf-cadence-card { width: 100%; border: 1px solid #dbe2ea; border-radius: 9px; padding: 13px; background: #fff; color: #334155; text-align: left; }
         .pf-cadence-card:hover { border-color: #93c5fd; background: #f8fbff; }
         .pf-cadence-card > div { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
         .pf-cadence-card span { font-size: 10px; font-weight: 800; }
         .pf-cadence-card span:first-child { border-radius: 999px; padding: 4px 7px; background: #0f172a; color: #fff; }
         .pf-cadence-card p { margin: 9px 0 0; color: #64748b; font-size: 12px; line-height: 1.55; }
 
         .pf-modal-overlay { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 18px; background: rgba(2,6,23,.62); backdrop-filter: blur(3px); }
         .pf-modal { width: 100%; max-height: 92vh; overflow: auto; border: 1px solid rgba(255,255,255,.4); border-radius: 13px; background: #fff; box-shadow: 0 25px 70px rgba(2,6,23,.32); }
         .pf-modal-sm { max-width: 540px; } .pf-modal-md { max-width: 680px; } .pf-modal-lg { max-width: 780px; }
         .pf-modal-header { padding: 18px 20px; color: #fff; }
         .pf-modal-header-blue { background: linear-gradient(135deg,#2563eb,#1e4f87); }
         .pf-modal-header-red { background: linear-gradient(135deg,#b91c1c,#e11d48); }
         .pf-modal-header-green { background: linear-gradient(135deg,#047857,#0f766e); }
         .pf-modal-header-orange { background: linear-gradient(135deg,#b45309,#ea580c); }
         .pf-modal-header-purple { background: linear-gradient(135deg,#6d28d9,#4338ca); }
         .pf-modal-header > div, .pf-modal-titlebar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
         .pf-modal-header h2, .pf-modal-titlebar h2 { margin: 0; font-size: 16px; font-weight: 900; }
         .pf-modal-header p, .pf-modal-titlebar p { margin: 4px 0 0; font-size: 11px; line-height: 1.45; opacity: .85; }
         .pf-modal-header button { border: 0; border-radius: 6px; padding: 5px 8px; background: rgba(255,255,255,.12); color: #fff; }
         .pf-modal-titlebar { position: sticky; top: 0; z-index: 2; padding: 15px 18px; border-bottom: 1px solid #e2e8f0; background: #fff; }
         .pf-modal-titlebar p { color: #64748b; opacity: 1; }
         .pf-modal-titlebar button { border: 0; border-radius: 7px; padding: 6px 9px; background: #f1f5f9; color: #64748b; font-weight: 900; }
         .pf-modal-body { display: grid; gap: 14px; padding: 18px; }
         .pf-modal-body > div[class*="rounded"] { border: 1px solid #dbe2ea; border-radius: 9px; padding: 11px 13px; background: #f8fafc; }
         .pf-modal-body label { display: block; margin-bottom: 6px; color: #475569; font-size: 11px; font-weight: 900; }
         .pf-modal-body textarea { width: 100%; border: 1px solid #cbd5e1; border-radius: 9px; padding: 10px 12px; background: #fff; color: #334155; font-size: 12px; line-height: 1.55; outline: none; resize: vertical; }
         .pf-modal-body textarea:focus { border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(96,165,250,.16); }
         .pf-modal-body > div[class*="grid-cols-2"] { display: grid; grid-template-columns: repeat(2,1fr); gap: 8px; }
         .pf-modal-body button, .pf-modal-footer button { border: 1px solid #cbd5e1; border-radius: 8px; padding: 9px 13px; background: #fff; color: #475569; font-size: 11px; font-weight: 800; }
         .pf-modal-body button[class*="bg-sky"], .pf-modal-footer button:last-child { border-color: #2563eb; background: #2563eb; color: #fff; }
         .pf-modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 13px 18px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
         .pf-modal-header-red ~ .pf-modal-footer button:last-child { border-color: #dc2626; background: #dc2626; }
         .pf-modal-header-green ~ .pf-modal-footer button:last-child { border-color: #059669; background: #059669; }
         .pf-modal-header-orange ~ .pf-modal-footer button:last-child { border-color: #ea580c; background: #ea580c; }
         .pf-modal-header-purple ~ .pf-modal-footer button:last-child { border-color: #7c3aed; background: #7c3aed; }

         .pf-modal-history { max-width: 760px; overflow: hidden; }
         .pf-history-titlebar { position: relative; align-items: center; border-bottom: 0; padding: 13px 16px; background: linear-gradient(135deg,#153b67,#245d96); color: #fff; }
         .pf-history-contact { display: flex; min-width: 0; align-items: center; gap: 10px; }
         .pf-history-avatar { display: inline-flex; width: 37px; height: 37px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 50%; background: rgba(255,255,255,.17); color: #fff; font-size: 9px; font-weight: 900; }
         .pf-history-titlebar h2 { color: #fff; font-size: 14px; }
         .pf-history-titlebar p { color: #dbeafe; font-size: 9px; }
         .pf-history-title-actions { display: flex; align-items: center; gap: 9px; }
         .pf-history-channel { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 5px 8px; background: rgba(16,185,129,.18); color: #d1fae5; font-size: 9px; font-weight: 900; }
         .pf-history-title-actions button { border: 0; border-radius: 7px; padding: 6px 9px; background: rgba(255,255,255,.12); color: #fff; font-weight: 900; }
         .pf-history-list { display: flex; min-height: 430px; max-height: 72vh; flex-direction: column; gap: 8px; overflow-y: auto; padding: 16px; background: #eaf0f6; }
         .pf-chat-row { display: flex; width: 100%; justify-content: flex-start; }
         .pf-chat-row.is-mine { justify-content: flex-end; }
         .pf-chat-row.is-system { justify-content: center; }
         .pf-chat-bubble { width: fit-content; max-width: 78%; border: 1px solid #dbe2ea; border-left: 3px solid #10b981; border-radius: 4px 11px 11px 11px; padding: 8px 10px; background: #fff; box-shadow: 0 1px 2px rgba(15,23,42,.05); }
         .pf-chat-row.is-mine .pf-chat-bubble { border-color: #bfdbfe; border-right: 3px solid #2563eb; border-left-width: 1px; border-radius: 11px 4px 11px 11px; background: #dbeafe; }
         .pf-chat-row.is-system .pf-chat-bubble { max-width: 88%; border: 0; border-radius: 999px; padding: 5px 10px; background: #dce4ed; color: #64748b; box-shadow: none; }
         .pf-chat-meta { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
         .pf-chat-meta strong { color: #047857; font-size: 9px; font-weight: 900; }
         .pf-chat-row.is-mine .pf-chat-meta strong { color: #1d4ed8; }
         .pf-chat-row.is-system .pf-chat-meta strong { color: #64748b; }
         .pf-chat-meta span { flex: 0 0 auto; color: #94a3b8; font-size: 8px; font-weight: 700; }
         .pf-chat-bubble p { margin: 5px 0 0; white-space: pre-wrap; color: #334155; font-size: 11px; line-height: 1.45; }
         .pf-chat-row.is-system .pf-chat-bubble p { margin-top: 2px; font-size: 9px; text-align: center; }
         .pf-open-channel-button { width: 100%; border-color: #93c5fd !important; background: #2563eb !important; color: #fff !important; }
         .pf-form-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; padding: 18px; }
         .pf-form-grid > div[class*="col-span-2"] { grid-column: 1 / -1; }
         .pf-form-grid label { display: block; color: #475569; font-size: 11px; font-weight: 900; }
         .campo {
           display: block; width: 100%; min-height: 38px; margin-top: 5px; border: 1px solid #cbd5e1;
           border-radius: 8px; padding: 8px 10px; background: #fff; color: #334155;
           font-size: 12px; font-weight: 600; outline: none;
         }
         textarea.campo { resize: vertical; line-height: 1.5; }
         .campo:focus { border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(96,165,250,.15); }
         .pf-import-body { gap: 16px; }
         .pf-import-type { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
         .pf-import-type button {
           display: flex; min-height: 72px; flex-direction: column; align-items: flex-start;
           justify-content: center; border: 1px solid #dbe2ea; border-radius: 9px;
           padding: 11px 12px; background: #fff; color: #475569; text-align: left;
         }
         .pf-import-type button strong { color: #1e293b; font-size: 12px; }
         .pf-import-type button span { margin-top: 4px; color: #64748b; font-size: 10px; line-height: 1.4; }
         .pf-import-type button.is-active { border-color: #60a5fa; background: #eff6ff; box-shadow: 0 0 0 2px rgba(96,165,250,.13); }
         .pf-import-type button.is-active strong { color: #1d4ed8; }
         .pf-file-picker {
           display: flex !important; min-height: 145px; align-items: center; justify-content: center;
           flex-direction: column; border: 2px dashed #93c5fd; border-radius: 11px;
           padding: 20px; background: #f5f9ff; color: #1e3a5f; text-align: center; cursor: pointer;
         }
         .pf-file-picker:hover { border-color: #2563eb; background: #eff6ff; }
         .pf-file-picker input { display: none; }
         .pf-file-picker .pf-file-icon { display: flex; width: 39px; height: 39px; align-items: center; justify-content: center; border-radius: 10px; background: #2563eb; color: #fff; font-size: 20px; }
         .pf-file-picker strong { max-width: 100%; margin-top: 9px; overflow: hidden; color: #1e293b; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
         .pf-file-picker small { margin-top: 4px; color: #64748b; font-size: 10px; }
         .pf-import-rules { border: 1px solid #dbe2ea !important; border-radius: 9px; padding: 12px 13px !important; background: #f8fafc !important; }
         .pf-import-rules > strong { color: #334155; font-size: 11px; }
         .pf-import-rules p { margin: 5px 0 9px; color: #64748b; font-size: 11px; line-height: 1.55; }
         .pf-import-rules button { padding: 7px 10px; border-color: #bfdbfe; color: #1d4ed8; }
         .pf-import-result { border: 1px solid #bfdbfe !important; border-radius: 8px; padding: 10px 12px !important; background: #eff6ff !important; color: #1e40af; font-size: 11px; font-weight: 800; }
 
         @media (max-width: 1100px) {
           .pf-commercial-workspace { grid-template-columns: 270px minmax(0,1fr); }
           .pf-selected-pane .pf-lead-card > div { grid-template-columns: 1fr; }
           .pf-selected-pane .pf-lead-actions { grid-column: auto; }
           .pf-lead-card > div { grid-template-columns: minmax(220px,.8fr) minmax(320px,1.2fr); }
           .pf-lead-actions { grid-column: 1 / -1; flex-direction: row; flex-wrap: wrap; padding: 9px 0 0; border-top: 1px solid #e2e8f0; border-left: 0; }
           .pf-lead-actions button { width: auto; }
           .pf-lead-actions > div { display: flex; }
         }
         @media (max-width: 760px) {
           .pf-page { padding: 15px 11px 35px; }
           .pf-header > div:last-child { align-items: flex-start; }
           .pf-header > div:last-child > div > div:first-child { display: none; }
           .pf-header h1 { font-size: 22px; }
           .pf-header h1 + p { max-width: 390px; }
           .pf-primary-button { padding: 9px 11px; }
           .pf-import-button { padding: 9px 11px; }
           .pf-toolbar > div { align-items: stretch; flex-direction: column; }
           .pf-search-row { width: 100%; }
           .pf-commercial-workspace { grid-template-columns: 1fr; min-height: 0; }
           .pf-prospect-sidebar { border-right: 0; border-bottom: 1px solid #dbe2ea; }
           .pf-prospect-list { max-height: 260px; }
           .pf-selected-pane { overflow: visible; }
           .pf-selected-pane .pf-lead-actions { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); }
           .pf-selected-pane .pf-lead-actions button { width: 100%; min-width: 0; }
           .pf-selected-pane .pf-lead-actions > div { display: grid; grid-column: 1 / -1; grid-template-columns: 1fr 1fr; }
           .pf-lead-card > div { grid-template-columns: 1fr; }
           .pf-message-preview { min-height: 135px; }
           .pf-lead-actions { grid-column: auto; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); }
           .pf-lead-actions button { width: 100%; }
           .pf-lead-actions > div { display: grid; grid-column: 1 / -1; grid-template-columns: 1fr 1fr; }
           .pf-form-grid { grid-template-columns: 1fr; }
           .pf-import-type { grid-template-columns: 1fr; }
           .pf-form-grid > div[class*="col-span-2"] { grid-column: auto; }
           .pf-history-titlebar { align-items: flex-start; }
           .pf-history-channel { display: none; }
           .pf-history-list { min-height: 390px; padding: 11px; }
           .pf-chat-bubble { max-width: 90%; }
         }
         @media (max-width: 480px) {
           .pf-header h1 + p, .pf-header div[class*="uppercase"] { display: none; }
           .pf-header-actions { flex-direction: column-reverse; align-items: stretch; }
           .pf-header-actions button { justify-content: center; }
           .pf-tabs { width: 100%; }
           .pf-tab { flex: 1; justify-content: center; }
           .pf-empty-state > div:nth-child(2):not(:last-child) { grid-template-columns: 1fr; }
           .pf-modal-overlay { padding: 9px; }
         }
       `}</style>
     </div>
   );
 }
 
 function Campo({ label, children }) {
   return (
     <label className="block text-xs font-black text-slate-600">
       {label}
       {children}
     </label>
   );
 }
 
