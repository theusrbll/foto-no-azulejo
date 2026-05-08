document.addEventListener("DOMContentLoaded", () => {
  const tokenSalvo = localStorage.getItem("selaron_token");
  const usuarioSalvo = localStorage.getItem("selaron_usuario");
  if (tokenSalvo && usuarioSalvo) {
    mostrarMenu(JSON.parse(usuarioSalvo));
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") fazerLogin();
  });
});

async function fazerLogin() {
  const nome = document.getElementById("nome").value.trim();
  const senha = document.getElementById("senha").value.trim();
  if (!nome || !senha) return;

  const btn = document.getElementById("btn-entrar");
  const erro = document.getElementById("erro");
  btn.disabled = true;
  btn.textContent = "Entrando...";
  erro.style.display = "none";

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, senha }),
    });
    const data = await res.json();

    if (!res.ok) {
      erro.textContent = data.erro || "Nome ou senha incorretos";
      erro.style.display = "block";
      btn.disabled = false;
      btn.textContent = "Entrar";
      return;
    }

    localStorage.setItem("selaron_token", data.token);
    localStorage.setItem("selaron_usuario", JSON.stringify(data.usuario));
    mostrarMenu(data.usuario);
  } catch (e) {
    erro.textContent = "Erro de conexão com o servidor";
    erro.style.display = "block";
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
}

function mostrarMenu(usuario) {
  const permissoes = [
    usuario.pode_vender,
    usuario.pode_producao,
    usuario.pode_gestao,
  ].filter(Boolean);

  if (permissoes.length === 1) {
    if (usuario.pode_vender) return (window.location.href = "/vendedor.html");
    if (usuario.pode_producao) return (window.location.href = "/producao.html");
    if (usuario.pode_gestao) return (window.location.href = "/gestao.html");
  }

  document.getElementById("tela-login").style.display = "none";
  document.getElementById("tela-menu").style.display = "block";
  document.getElementById("menu-saudacao").innerHTML =
    `Olá, <strong>${usuario.nome}</strong>. O que deseja acessar?`;

  document.getElementById("opcao-vendas").style.display = usuario.pode_vender
    ? "flex"
    : "none";
  document.getElementById("opcao-producao").style.display =
    usuario.pode_producao ? "flex" : "none";
  document.getElementById("opcao-gestao").style.display = usuario.pode_gestao
    ? "flex"
    : "none";
}

function sair() {
  localStorage.removeItem("selaron_token");
  localStorage.removeItem("selaron_usuario");
  document.getElementById("tela-menu").style.display = "none";
  document.getElementById("tela-login").style.display = "block";
  document.getElementById("nome").value = "";
  document.getElementById("senha").value = "";
}
