 import React, { useEffect, useState } from "react";
import { buildWebhookUrl } from "../config/globals";

export default function CategoriaModelos() {
  const [dados, setDados] = useState([]);
  const [editando, setEditando] = useState(null);

  async function carregar() {
    const r = await fetch(buildWebhookUrl("categoria_modelo"));
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
         <th>Categoria id</th>
      <th>Empresa</th>
      <th>Categoria</th> 
      <th>Tipo</th>
       <th>Classificação</th>
      <th>modelo_id</th>
      <th>Tipo Operacao</th> 
       <th>Vinculo</th> 
    
    </tr>
  </thead>               

  <tbody>
    {dados.map((d) => (
      <tr key={d.categoria_id}>
         <td>{d.categoria_id}</td>
          <td>{d.empresa_id}</td>
        <td>{d.categoria}</td>
        <td>{d.tipo}</td>
        <td>{d.classificacao}</td>
        <td>{d.modelo_id}</td>
        <td>{d.forma_operacao}</td>
        <td>{d.vinculo_ativo }</td> 
      
         
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
