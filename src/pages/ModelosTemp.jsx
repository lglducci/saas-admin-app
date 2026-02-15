 import React, { useEffect, useState } from "react";
import { buildWebhookUrl } from "../config/globals";

export default function ModelosTemp() {
  const [dados, setDados] = useState([]);
  const [editando, setEditando] = useState(null);

  async function carregar() {
    const r = await fetch(buildWebhookUrl("modelos_temp"));
    const j = await r.json();
    setDados(j);
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Template Eventos Contábeis</h1>

      <button
        onClick={() => setEditando({})}
        className="bg-blue-700 text-white px-4 py-2 rounded mb-4"
      >
        Novo
      </button>
     <table style={{ width: "100%", textAlign: "left" }}>
  <thead>
    <tr>
         <th>id</th>
      <th>Código</th>
      <th>Descrição</th>
      <th>Classificação</th>
      <th>Tipo</th>
      <th>Conta Débito</th>
      <th>Conta Crédito</th> 
       <th>Natureza</th> 
      <th>Ações</th>
    </tr>
  </thead>

  <tbody>
    {dados.map((d) => (
      <tr key={d.id}>
          <td>{d.id}</td>
        <td>{d.codigo_evento}</td>
        <td>{d.descricao}</td>
        <td>{d.classificacao}</td>
        <td>{d.tipo_evento}</td>
        <td>{d.conta_debito_codigo}</td>
        <td>{d.conta_credito_codigo}</td>

        <td>{d.natureza_fluxo}</td>
      
        <td>
          <button onClick={() => setEditando(d)}>
            Editar
          </button>
        </td>
      </tr>
    ))}
  </tbody>
</table>

      {editando && (
        <CadastroTemplate
          registro={editando}
          onClose={() => {
            setEditando(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}
