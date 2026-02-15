 import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildWebhookUrl } from "../config/globals";
import FormContaContabilModal from "../components/forms/FormContaContabilModal"; 
import ModalBase from "../components/ModalBase";

export default function MapeamentoContabil() {
  const navigate = useNavigate();
  const empresa_id = localStorage.getItem("empresa_id") || localStorage.getItem("id_empresa") ;

  const [lista, setLista] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [linhas, setLinhas] = useState([]);

const [filtro, setFiltro] = useState("");
  const [modalContaContabil, setModalContaContabil] = useState(false);
 
 // const contaGerencialId = state?.conta_gerencial_id;

  async function carregarModelos() {
    try {
      const url = buildWebhookUrl("modelos_temp",  );
      const r = await fetch(url);
      const j = await r.json();
      setLista(j);
    } catch (e) {
      console.log("Erro ao carregar modelos:", e);
    }
  }

 async function visualizar(id_modelo) {
  try {
    const url = buildWebhookUrl("modelos_linhas", {
      empresa_id,
      modelo_id: id_modelo,
    });

    const r = await fetch(url);
    const dados = await r.json();

    // garante que vai encontrar mesmo se id for string/number
    const modeloInfo = lista.find(
      (m) => String(m.id) === String(id_modelo)
    );

    setSelecionado({
      codigo: modeloInfo?.codigo || "",
      nome: modeloInfo?.nome || "",
      tipo: modeloInfo?.tipo_automacao || "",
    });

    setLinhas(dados);

  } catch (e) {
    console.log("Erro ao carregar linhas:", e);
  }
}



 async function Excluir(modelo_id) {
  
  if (!window.confirm("Tem certeza que deseja excluir este modelo?")) {
    return;
  }

  try {
    const url = buildWebhookUrl("excluirmodelo", {
      empresa_id:empresa_id,
      modelo_id,
    });

    const resp = await fetch(url, { method: "POST" });

    const texto = await resp.text();
    let json = null;

    try {
      json = JSON.parse(texto);
    } catch (e) {
      console.log("JSON inválido:", texto);
      alert("Erro inesperado no servidor.");
      return;
    }

    // quando webhook retorna array
    const item = Array.isArray(json) ? json[0] : json;

    // erro controlado pelo backend
    if (item?.ok === false) {
      alert(item.message || "Erro ao excluir.");
      return;
    }

    alert("Modelo excluído com sucesso!");

    // recarrega a lista
    carregarModelos();

  } catch (e) {
    console.log("ERRO REQUEST:", e);
    alert("Erro de comunicação com o servidor.");
  }
}



 


 function editar(m) {
  const empresa_id = localStorage.getItem("empresa_id") || "1";

  navigate("/edita-mapeamento", {
    state: {
      modelo_id: m.id,
      empresa_id: empresa_id ,
      token: m.codigo,   // <<< VOLTOU O QUE VOCÊ FALOU
      nome: m.nome,     
    }
  });
}




  useEffect(() => {
    carregarModelos();
  }, []);



  const filtrados = lista.filter((m) =>
  m.codigo?.toLowerCase().includes(filtro.toLowerCase()) ||
  m.nome?.toLowerCase().includes(filtro.toLowerCase()) ||
  m.tipo_automacao?.toLowerCase().includes(filtro.toLowerCase())
);
 return (
  <div className="p-4 w-full">

    {/* ===== HEADER / CONTEXTO ===== */}
    <div className="bg-white rounded-xl border-l-4  shadow-sm p-4 mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-blue-800">
          Modelo Contábil
        </h2>

        <div className="flex gap-4">
          <button
            onClick={() => navigate("/novo-modelo")}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            + Novo Modelo
          </button>
 
         
          <button
            onClick={() => setModalContaContabil(true)}
            className="px-6 py-2 rounded-lg bg-[#061f4a] text-white font-semibold hover:brightness-110"
          >
            ➕ Adicionar Conta
          </button>



        </div>
      </div>

      {selecionado && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <p className="text-sm text-gray-500">Token</p>
            <p className="font-semibold text-gray-800">{selecionado.codigo}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Modelo</p>
            <p className="font-semibold text-gray-800">{selecionado.nome}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Tipo de Automação</p>
            <p className="font-semibold text-gray-800">{selecionado.tipo}</p>
          </div>
        </div>
      )}
    </div>

    {/* ===== FILTRO ===== */}
    <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex items-center gap-4">
      <span className="font-semibold text-gray-700">Buscar:</span>
      <input
        type="text"
        placeholder="Token, descrição ou tipo de automação…"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    {/* ===== DETALHE DO MODELO ===== */}
    {linhas.length > 0 && (
      <div className="bg-white rounded-xl shadow-sm p-4 mb-8">
        <h3 className="font-bold text-gray-800 mb-3">
          Estrutura do Modelo
        </h3>

        <table className="w-full text-sm border-collapse">
          <thead className="bg-blue-100 text-gray-700">
            <tr>
              <th className="p-2 text-left">Conta</th>
              <th className="p-2 text-left">Código</th>
              <th className="p-2 text-left">Nome</th>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-left">Natureza</th>
              <th className="p-2 text-center">D/C</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr
                key={i}
                 className={i % 2 === 0 ? "bg-gray-150" : "bg-gray-50"}
              >
                <td className="p-2 font-bold" >{l.conta_id}</td>
                <td className="p-2 font-bold">{l.codigo}</td>
                <td className="p-2 font-bold">{l.nome}</td>
                <td className="p-2 font-bold">{l.tipo}</td>
                <td className="p-2 font-bold">{l.natureza}</td>
                <td className="p-2 text-center font-bold">{l.dc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    {/* ===== LISTA DE MODELOS ===== */}
    <div className="bg-white rounded-xl shadow-sm p-4">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-100 text-blue-800">
          <tr>
            <th className="p-2 text-left">ID</th>
            <th className="p-2 text-left">Token</th>
            <th className="p-2 text-left">Descrição</th>
            <th className="p-2 text-left">Tipo</th>
            <th className="p-2 text-left">Ações</th>
            <th className="p-2 text-center">Origem</th>
          </tr>
        </thead>

        <tbody>
          {filtrados.map((m, i) => (
            <tr
              key={m.id}
              className={i % 2 === 0 ? "bg-gray-150" : "bg-gray-100"}
            >
              <td className="p-2 font-semibold">{m.id}</td>
              <td className="p-2 font-semibold">{m.codigo}</td>
              <td className="p-2">{m.nome}</td>
              <td className="p-2">{m.tipo_automacao}</td>

              <td className="p-2 flex gap-4">
                <span
                  onClick={() => visualizar(m.id)}
                  className="text-emerald-700 font-semibold cursor-pointer"
                >
                  Visualizar
                </span>

                {!m.sistema && (
                  <>
                    <span
                      onClick={() =>
                        navigate("/editar-mapeamento", {
                          state: {
                            modelo_id: m.id,
                            empresa_id,
                            token: m.codigo,
                            nome: m.nome,
                            tipo: m.tipo_automacao,
                          },
                        })
                      }
                      className="text-blue-700 font-semibold cursor-pointer"
                    >
                      Editar
                    </span>

                    <span
                      onClick={() => Excluir(m.id)}
                      className="text-red-700 font-semibold cursor-pointer"
                    >
                      Excluir
                    </span>
                  </>
                )}
              </td>

              <td className="p-2 text-center font-bold">
                {m.sistema ? (
                  <span className="text-red-600">Sistema</span>
                ) : (
                  <span className="text-blue-700">Usuário</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
     
      <ModalBase
            open={modalContaContabil}
            onClose={() => setModalContaContabil(false)}
            title="Nova Conta Contábil"
          >
            <FormContaContabilModal
                empresa_id={empresa_id}
                onSuccess={() => {
                  setModalContaContabil(false);
                 
                }}
                onCancel={() => setModalContaContabil(false)}
              /> 
        </ModalBase>
  </div>
);

   
}
