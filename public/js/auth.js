function getToken() {
  return localStorage.getItem("selaron_token");
}

function getUsuario() {
  const u = localStorage.getItem("selaron_usuario");
  return u ? JSON.parse(u) : null;
}

function sair() {
  localStorage.removeItem("selaron_token");
  localStorage.removeItem("selaron_usuario");
  window.location.href = "/login.html";
}

function voltarMenu() {
  const u = getUsuario();
  if (!u) return sair();
  const permissoes = [u.pode_vender, u.pode_producao, u.pode_gestao].filter(
    Boolean,
  );
  if (permissoes.length <= 1) return sair();
  window.location.href = "/login.html";
}

async function fetchAuth(url, opcoes = {}) {
  const token = getToken();
  const headers = {
    ...(opcoes.headers || {}),
    Authorization: "Bearer " + token,
  };
  const res = await fetch(url, { ...opcoes, headers });
  if (res.status === 401) {
    sair();
    throw new Error("Sessão expirada");
  }
  return res;
}
