let timers = {};
let somAtivo = false;
let audioCtx = null;
let idsAnteriores = new Set();
let usuarioLogado = null;

document.addEventListener("DOMContentLoaded", () => {
  usuarioLogado = getUsuario();
  if (!usuarioLogado || !usuarioLogado.pode_producao) {
    window.location.href = "/login.html";
    return;
  }
  carregarPedidos();
  setInterval(carregarPedidos, 5000);
});

function toggleSom() {
  somAtivo = !somAtivo;
  document.getElementById("btn-som").textContent =
    "Som: " + (somAtivo ? "ON" : "OFF");
  if (somAtivo && !audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function tocarSom() {
  if (!somAtivo || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, audioCtx.currentTime);
  osc.frequency.setValueAtTime(660, audioCtx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.5);
}

async function carregarPedidos() {
  try {
    const res = await fetchAuth("/api/pedidos/kanban");
    const data = await res.json();

    const todosIds = [...data.novos, ...data.emProducao, ...data.prontos].map(
      (p) => p.id,
    );

    let temNovo = false;
    data.novos.forEach((p) => {
      if (!idsAnteriores.has(p.id) && idsAnteriores.size > 0) temNovo = true;
    });
    if (temNovo) tocarSom();
    idsAnteriores = new Set(todosIds);

    Object.keys(timers).forEach((id) => {
      if (!todosIds.includes(id)) {
        clearInterval(timers[id]);
        delete timers[id];
      }
    });

    renderColuna("col-novo", data.novos, "novo");
    renderColuna("col-producao", data.emProducao, "producao");
    renderColuna("col-pronto", data.prontos, "pronto");

    document.getElementById("badge-novo").textContent = data.novos.length;
    document.getElementById("badge-producao").textContent =
      data.emProducao.length;
    document.getElementById("badge-pronto").textContent = data.prontos.length;
  } catch (e) {
    console.error("Erro ao carregar pedidos", e);
  }
}

function renderColuna(colId, lista, tipo) {
  const col = document.getElementById(colId);

  if (lista.length === 0) {
    col.innerHTML = '<div class="coluna-vazia">Nenhum pedido</div>';
    return;
  }

  const vazio = col.querySelector(".coluna-vazia");
  if (vazio) vazio.remove();

  const idsNovos = new Set(lista.map((p) => p.id));

  col.querySelectorAll(".kanban-card[data-id]").forEach((el) => {
    if (!idsNovos.has(el.dataset.id)) {
      clearInterval(timers[el.dataset.id]);
      delete timers[el.dataset.id];
      el.remove();
    }
  });

  lista.forEach((p) => {
    if (!document.getElementById("card-" + p.id)) {
      col.appendChild(criarCard(p, tipo));
      if (tipo !== "pronto") iniciarTimer(p.id, new Date(p.criado_em));
    }
  });

  lista.forEach((p, i) => {
    const el = document.getElementById("card-" + p.id);
    if (el && col.children[i] !== el) col.appendChild(el);
  });
}

function criarCard(p, tipo) {
  const div = document.createElement("div");
  div.className = "kanban-card" + (tipo === "pronto" ? " finalizado" : "");
  div.id = "card-" + p.id;
  div.dataset.id = p.id;

  const finalizado = p.atualizado_em ? new Date(p.atualizado_em) : null;

  let timerHtml = "";
  if (tipo === "novo" || tipo === "producao") {
    timerHtml = `<span class="timer ok" id="timer-${p.id}">10:00</span>`;
  } else {
    const hora = finalizado
      ? finalizado.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    timerHtml = `<span class="timer pausado">Pronto às ${hora}</span>`;
  }

  let acoesHtml = "";
  if (tipo === "novo") {
    acoesHtml = `<div class="card-acoes"><button class="btn-iniciar" onclick="moverStatus('${p.id}','em_producao')">Iniciar produção</button></div>`;
  } else if (tipo === "producao") {
    acoesHtml = `<div class="card-acoes"><button class="btn-concluir" onclick="moverStatus('${p.id}','pronto')">Marcar como pronto</button></div>`;
  }

  div.innerHTML = `
    <div class="card-foto-wrap">
      <img class="card-foto" src="/uploads/${p.foto}" alt="Foto do pedido">
      <a href="/uploads/${p.foto}" download="pedido-${p.numero}.jpg" class="salvar-foto">Salvar foto</a>
    </div>
    <div class="card-corpo">
      <div class="card-topo">
        <span class="card-numero">${p.numero}</span>
        ${timerHtml}
      </div>
      <div class="card-badges">
        <span class="card-badge">${p.tamanho}</span>
        <span class="card-badge">R$ ${parseFloat(p.preco).toFixed(2)}</span>
        <span class="card-badge ponto">${p.ponto_venda}</span>
        <span class="card-badge">${p.vendedor_nome}</span>
      </div>
      ${p.nome_cliente ? `<div class="card-cliente">${p.nome_cliente}</div>` : ""}
      ${acoesHtml}
    </div>
  `;
  return div;
}

function iniciarTimer(id, criado) {
  if (timers[id]) {
    clearInterval(timers[id]);
    delete timers[id];
  }

  const LIMITE = 10 * 60 * 1000;

  function atualizar() {
    const el = document.getElementById("timer-" + id);
    const card = document.getElementById("card-" + id);
    if (!el || !card) {
      clearInterval(timers[id]);
      delete timers[id];
      return;
    }

    const decorrido = Date.now() - criado.getTime();
    const restante = LIMITE - decorrido;

    if (restante <= 0) {
      el.textContent = "00:00";
      el.className = "timer urgente";
      card.classList.add("urgente");
      card.classList.remove("quase");
      return;
    }

    const min = Math.floor(restante / 60000);
    const seg = Math.floor((restante % 60000) / 1000);
    el.textContent =
      String(min).padStart(2, "0") + ":" + String(seg).padStart(2, "0");

    if (restante < 2 * 60 * 1000) {
      el.className = "timer urgente";
      card.classList.add("urgente");
      card.classList.remove("quase");
    } else if (restante < 4 * 60 * 1000) {
      el.className = "timer quase";
      card.classList.add("quase");
      card.classList.remove("urgente");
    } else {
      el.className = "timer ok";
      card.classList.remove("urgente", "quase");
    }
  }

  atualizar();
  timers[id] = setInterval(atualizar, 1000);
}

async function moverStatus(id, status) {
  const btn = document.querySelector(
    `#card-${id} .btn-iniciar, #card-${id} .btn-concluir`,
  );
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Salvando...";
  }
  try {
    await fetchAuth(`/api/pedidos/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await carregarPedidos();
  } catch (e) {
    if (btn) {
      btn.disabled = false;
      btn.textContent =
        status === "em_producao" ? "Iniciar produção" : "Marcar como pronto";
    }
    alert("Erro ao atualizar. Tente novamente.");
  }
}
