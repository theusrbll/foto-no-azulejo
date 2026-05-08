let usuario = null;
let fotoSelecionada = null;
let pontoSelecionado = "cima";
let produtos = [];
let carrinho = {};

document.addEventListener("DOMContentLoaded", () => {
  usuario = getUsuario();
  if (!usuario || !usuario.pode_vender) {
    window.location.href = "/login.html";
    return;
  }
  document.getElementById("info-vendedor").textContent = usuario.nome;
  carregarProdutos();
});

async function carregarProdutos() {
  try {
    const res = await fetchAuth("/api/produtos");
    produtos = await res.json();
    renderProdutos();
  } catch (e) {
    document.getElementById("lista-produtos").innerHTML =
      '<div class="vazio-produtos">Erro ao carregar produtos</div>';
  }
}

function renderProdutos() {
  const lista = document.getElementById("lista-produtos");
  if (produtos.length === 0) {
    lista.innerHTML =
      '<div class="vazio-produtos">Nenhum produto cadastrado</div>';
    return;
  }
  lista.innerHTML = produtos
    .map(
      (p) => `
    <div class="produto-item">
      <div class="produto-info">
        <div class="produto-nome">${p.nome}</div>
        <div class="produto-preco">R$ ${parseFloat(p.preco).toFixed(2)}</div>
      </div>
      <div class="quantidade-ctrl">
        <button class="qty-btn" onclick="alterarQtd('${p.id}', -1)">−</button>
        <span class="qty-num" id="qty-${p.id}">0</span>
        <button class="qty-btn" onclick="alterarQtd('${p.id}', 1)">+</button>
      </div>
    </div>
  `,
    )
    .join("");
}

function alterarQtd(id, delta) {
  const atual = carrinho[id] || 0;
  const novo = Math.max(0, atual + delta);
  if (novo === 0) delete carrinho[id];
  else carrinho[id] = novo;
  document.getElementById("qty-" + id).textContent = novo;
  atualizarResumo();
}

function atualizarResumo() {
  const ids = Object.keys(carrinho);
  const resumoEl = document.getElementById("carrinho-resumo");
  const linhasEl = document.getElementById("carrinho-linhas");

  if (ids.length === 0) {
    resumoEl.style.display = "none";
    return;
  }

  let total = 0;
  let totalItens = 0;
  let html = "";

  ids.forEach((id) => {
    const prod = produtos.find((p) => p.id === id);
    if (!prod) return;
    const subtotal = prod.preco * carrinho[id];
    total += subtotal;
    totalItens += carrinho[id];
    html += `<div class="carrinho-linha"><span>${prod.nome} × ${carrinho[id]}</span><span>R$ ${subtotal.toFixed(2)}</span></div>`;
  });

  html += `<div class="carrinho-linha"><span>${totalItens} item(s)</span><span>R$ ${total.toFixed(2)}</span></div>`;
  linhasEl.innerHTML = html;
  resumoEl.style.display = "block";
}

function selecionarPonto(ponto) {
  pontoSelecionado = ponto;
  document
    .getElementById("ponto-cima")
    .classList.toggle("selecionado", ponto === "cima");
  document
    .getElementById("ponto-baixo")
    .classList.toggle("selecionado", ponto === "baixo");
}

function abrirCamera() {
  document.getElementById("input-camera").click();
}
function abrirGaleria() {
  document.getElementById("input-galeria").click();
}

function mostrarPreview(input) {
  if (!input.files[0]) return;
  fotoSelecionada = input.files[0];
  const url = URL.createObjectURL(fotoSelecionada);
  const img = document.getElementById("preview-foto");
  img.src = url;
  img.style.display = "block";
  document.getElementById("foto-placeholder").style.display = "none";
}

async function enviarPedido() {
  if (!fotoSelecionada) return alert("Tire uma foto primeiro");
  const itensCarrinho = Object.keys(carrinho);
  if (itensCarrinho.length === 0)
    return alert("Adicione pelo menos um produto");

  const btn = document.getElementById("btn-enviar");
  btn.disabled = true;
  btn.textContent = "Enviando...";

  const itens = itensCarrinho.map((id) => {
    const prod = produtos.find((p) => p.id === id);
    return { id, nome: prod.nome, preco: prod.preco, quantidade: carrinho[id] };
  });

  const form = new FormData();
  form.append("foto", fotoSelecionada);
  form.append("ponto_venda", pontoSelecionado);
  form.append("nome_cliente", document.getElementById("nome-cliente").value);
  form.append("itens", JSON.stringify(itens));

  try {
    const token = getToken();
    const res = await fetch("/api/pedidos/lote", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: form,
    });

    if (res.status === 401) {
      sair();
      return;
    }

    if (!res.ok) {
      const erro = await res.json();
      alert("Erro: " + (erro.erro || "Tente novamente"));
      btn.disabled = false;
      btn.textContent = "Enviar pedido para produção";
      return;
    }

    const data = await res.json();
    mostrarSucesso(data.pedidos);
  } catch (e) {
    console.error(e);
    alert("Erro ao enviar pedido. Verifique a conexão.");
    btn.disabled = false;
    btn.textContent = "Enviar pedido para produção";
  }
}

function mostrarSucesso(pedidos) {
  const lista = document.getElementById("lista-pedidos-criados");
  lista.innerHTML = pedidos
    .map(
      (p) => `
    <div class="pedido-card">
      <div class="pedido-card-topo">
        <div>
          <div class="pedido-numero">${p.numero}</div>
          <div class="pedido-produto">${p.produto}</div>
        </div>
        <img class="pedido-qr" src="${p.qrCode}" alt="QR Code">
      </div>
    </div>
  `,
    )
    .join("");
  document.getElementById("tela-pedido").style.display = "none";
  document.getElementById("tela-sucesso").style.display = "block";
}

function novoPedido() {
  fotoSelecionada = null;
  carrinho = {};
  pontoSelecionado = "cima";
  document.getElementById("preview-foto").style.display = "none";
  document.getElementById("preview-foto").src = "";
  document.getElementById("foto-placeholder").style.display = "flex";
  document.getElementById("input-camera").value = "";
  document.getElementById("input-galeria").value = "";
  document.getElementById("nome-cliente").value = "";
  document.getElementById("carrinho-resumo").style.display = "none";
  selecionarPonto("cima");
  renderProdutos();
  document.getElementById("tela-sucesso").style.display = "none";
  document.getElementById("tela-pedido").style.display = "block";
  document.getElementById("btn-enviar").disabled = false;
  document.getElementById("btn-enviar").textContent =
    "Enviar pedido para produção";
}
