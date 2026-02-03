 // src/utils/api.js

export async function callApi(url, payload = null, method = "POST") {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (payload) {
    options.body = JSON.stringify(payload);
  }

  let resp;
  try {
    resp = await fetch(url, options);
  } catch {
    throw new Error("Falha de comunicação com o servidor.");
  }

  let json = {};
  try {
    json = await resp.json();
  } catch {
    throw new Error("Resposta inválida do servidor.");
  }

  // ❌ ERRO FUNCIONAL OU HTTP
  if (!resp.ok || json.success === false) {
    throw new Error(json.message || "Erro inesperado.");
  }

  // ✅ SUCESSO
  return json;
}
