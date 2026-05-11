const idiomas = {
  pt: {
    titulo: "Acompanhe seu pedido",
    subtitulo: "Digite o código que está no seu comprovante",
    buscaLabel: "Código do pedido",
    buscar: "Buscar",
    aguardando: "Aguardando",
    emProducao: "Em produção",
    pronto: "Pronto para retirar",
    msgAguardando: "Recebemos seu pedido e em breve iniciaremos a produção.",
    msgProducao: "Seu azulejo está sendo produzido com carinho.",
    msgPronto: "Seu azulejo está pronto! Retire com o vendedor.",
    tamanho: "Tamanho",
    horario: "Pedido às",
    baixar: "Baixar minha foto",
    atualizando: "Atualizando automaticamente",
    erroTitulo: "Pedido não encontrado",
    erroMsg: "Verifique o código e tente novamente.",
    carregando: "Buscando seu pedido...",
  },
  en: {
    titulo: "Track your order",
    subtitulo: "Enter the code on your receipt",
    buscaLabel: "Order code",
    buscar: "Search",
    aguardando: "Waiting",
    emProducao: "In production",
    pronto: "Ready to pick up",
    msgAguardando: "We received your order and will start production soon.",
    msgProducao: "Your tile is being carefully crafted.",
    msgPronto: "Your tile is ready! Pick it up from the vendor.",
    tamanho: "Size",
    horario: "Ordered at",
    baixar: "Download my photo",
    atualizando: "Auto-updating",
    erroTitulo: "Order not found",
    erroMsg: "Check the code and try again.",
    carregando: "Looking up your order...",
  },
  es: {
    titulo: "Sigue tu pedido",
    subtitulo: "Ingresa el código de tu comprobante",
    buscaLabel: "Código del pedido",
    buscar: "Buscar",
    aguardando: "En espera",
    emProducao: "En producción",
    pronto: "Listo para retirar",
    msgAguardando: "Recibimos tu pedido y pronto comenzaremos la producción.",
    msgProducao: "Tu azulejo está siendo producido con cariño.",
    msgPronto: "¡Tu azulejo está listo! Recógelo con el vendedor.",
    tamanho: "Tamaño",
    horario: "Pedido a las",
    baixar: "Descargar mi foto",
    atualizando: "Actualizando automáticamente",
    erroTitulo: "Pedido no encontrado",
    erroMsg: "Verifica el código e intenta de nuevo.",
    carregando: "Buscando tu pedido...",
  },
};

let idiomaAtual = "pt";
let codigoAtual = null;
let intervaloStatus = null;

function t(key) {
  return idiomas[idiomaAtual][key];
}

function mudarIdioma(lang) {
  idiomaAtual = lang;
  document
    .querySelectorAll(".lang-btn")
    .forEach((b) => b.classList.remove("ativo"));
  document
    .querySelector(`.lang-btn[data-lang="${lang}"]`)
    .classList.add("ativo");
  document.getElementById("inicio-titulo").textContent = t("titulo");
  document.getElementById("inicio-msg").textContent = t("subtitulo");
  document.getElementById("busca-label").textContent = t("buscaLabel");
  document.getElementById("busca-btn").textContent = t("buscar");
  if (codigoAtual) buscar(codigoAtual, true);
}

function statusClass(status) {
  if (status === "pronto") return "pronto";
  if (status === "em_producao") return "em_producao";
  return "aguardando";
}

function statusLabel(status) {
  if (status === "pronto") return t("pronto");
  if (status === "em_producao") return t("emProducao");
  return t("aguardando");
}

function statusMsg(status) {
  if (status === "pronto") return t("msgPronto");
  if (status === "em_producao") return t("msgProducao");
  return t("msgAguardando");
}

function renderizar(pedido) {
  codigoAtual = pedido.numero;
  const criado = new Date(pedido.criado_em);
  const horario = criado.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const sc = statusClass(pedido.status);
  const isProto = pedido.status === "pronto";

  document.getElementById("conteudo").innerHTML = `
    <div class="foto-wrap">
      <img
        src="/uploads/${pedido.foto}"
        alt="Sua foto"
        onclick="baixarFoto()"
        title="${t("baixar")}"
        onerror="this.parentElement.innerHTML='<div class=foto-placeholder><svg width=48 height=48 viewBox=0 0 24 24 fill=none stroke=currentColor stroke-width=1><path d=M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z/><circle cx=12 cy=13 r=4/></svg></div>'"
      >
    </div>
    <div class="rastrear-corpo">
      <div class="numero-wrap">
        <span class="rastrear-numero">${pedido.numero}</span>
        <span class="status-pill ${sc}">
          <span class="dot"></span>
          ${statusLabel(pedido.status)}
        </span>
      </div>
      <p class="status-msg">${statusMsg(pedido.status)}</p>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-item-label">${t("tamanho")}</div>
          <div class="info-item-valor">${pedido.tamanho}</div>
        </div>
        <div class="info-item">
          <div class="info-item-label">${t("horario")}</div>
          <div class="info-item-valor">${horario}</div>
        </div>
      </div>
      <hr class="rastrear-divider">
      <a class="btn btn-dark btn-full" onclick="baixarFoto()" href="javascript:void(0)" style="text-decoration:none;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        ${t("baixar")}
      </a>
      ${!isProto ? `<p class="atualiza">${t("atualizando")}</p>` : ""}
    </div>
    <hr style="border:none;border-top:1px solid var(--borda);margin:0">
  `;

  if (!isProto) {
    clearInterval(intervaloStatus);
    intervaloStatus = setInterval(() => buscar(codigoAtual, true), 10000);
  } else {
    clearInterval(intervaloStatus);
  }
}

function renderizarErro() {
  clearInterval(intervaloStatus);
  document.getElementById("conteudo").innerHTML = `
    <div class="erro-wrap">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${"var(--vermelho)"}" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <circle cx="12" cy="16" r="0.5" fill="var(--vermelho)"/>
      </svg>
      <div class="erro-titulo">${t("erroTitulo")}</div>
      <p class="erro-msg">${t("erroMsg")}</p>
    </div>
    <hr style="border:none;border-top:1px solid var(--borda);margin:0">
  `;
}

function renderizarLoading() {
  document.getElementById("conteudo").innerHTML = `
    <div class="loading-wrap">
      <div class="spinner"></div>
      ${t("carregando")}
    </div>
  `;
}

function baixarFoto() {
  if (!codigoAtual) return;
  const link = document.createElement("a");
  link.href = `/api/foto/${codigoAtual}`;
  link.download = `foto-ceramica-${codigoAtual}.jpg`;
  link.click();
}

async function buscar(numero, silencioso = false) {
  const cod = (numero || document.getElementById("busca-input").value)
    .trim()
    .toUpperCase();
  if (cod.length < 6) return;
  if (!silencioso) renderizarLoading();
  try {
    const res = await fetch(`/api/rastrear/${cod}`);
    if (!res.ok) return renderizarErro();
    const pedido = await res.json();
    renderizar(pedido);
  } catch (e) {
    renderizarErro();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const numeroUrl = params.get("pedido");

  document.getElementById("busca-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") buscar();
  });

  if (numeroUrl) {
    buscar(numeroUrl);
  }
});
