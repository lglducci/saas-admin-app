// src/utils/datas.js

// hoje local em YYYY-MM-DD sem problema de fuso
export function hojeLocalISO() {
  const agora = new Date();
  const offsetMs = agora.getTimezoneOffset() * 60000;
  const local = new Date(agora.getTime() - offsetMs);
  return local.toISOString().split("T")[0];
}

// calcula datas a partir do tipo e de um "hoje" opcional
export function calcularPeriodo(tipo, hojeStr) {
  const base = hojeStr ? new Date(hojeStr) : new Date();
  let ini = new Date(base);
  let fim = new Date(base);

  if (tipo === "mes") {
    ini = new Date(base.getFullYear(), base.getMonth(), 1);
  } else if (tipo === "15") {
    ini.setDate(base.getDate() - 15);
  } else if (tipo === "semana") {
    ini.setDate(base.getDate() - 7);
  } else if (tipo === "hoje") {
    // ini já é hoje
  } else {
    ini.setDate(base.getDate() - 30);
  }

  return {
    inicio: ini.toISOString().split("T")[0],
    fim: fim.toISOString().split("T")[0],
  };
}



 