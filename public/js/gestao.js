let usuarioLogado = null;

document.addEventListener("DOMContentLoaded", () => {
  usuarioLogado = getUsuario();
  if (!usuarioLogado || !usuarioLogado.pode_gestao) {
    window.location.href = "/login.html";
    return;
  }

  const hoje = new Date().toISOString().slice(0, 10);
  document.getElementById("filtro-data").value = hoje;
  document.getElementById("data-hoje").textContent =
    new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  carregarTudo();
  setInterval(carregarTudo, 30000);
});

function mostrarAba(aba) {
  ["resumo", "produtos", "usuarios"].forEach((a) => {
    document.getElementById("painel-" + a).style.display =
      a === aba ? "block" : "none";
    document.getElementById("aba-" + a).className =
      a === aba ? "aba ativa" : "aba inativa";
  });
  if (aba === "usuarios") carregarUsuarios();
  if (aba === "produtos") carregarProdutosGestao();
}

async function carregarTudo() {
  const data = document.getElementById("filtro-data").value;
  await Promise.all([carregarResumo(), carregarHistorico(data)]);
}

async function carregarResumo() {
  const data = document.getElementById("filtro-data").value;
  const res = await fetchAuth("/api/gestao/resumo?data=" + data);
  const d = await res.json();

  const total = d.totalDia.total || 0;
  const fat = d.totalDia.faturamento || 0;
  const ticket = total > 0 ? fat / total : 0;

  document.getElementById("m-total").textContent = total;
  document.getElementById("m-faturamento").textContent = "R$ " + fat.toFixed(2);
  document.getElementById("m-ticket").textContent = "R$ " + ticket.toFixed(2);
  document.getElementById("m-atrasados").textContent = d.atrasados.total;

  const alertaEl = document.getElementById("alerta-atrasados");
  if (d.atrasados.total > 0) {
    alertaEl.style.display = "flex";
    document.getElementById("texto-alerta").textContent =
      `${d.atrasados.total} pedido(s) passaram de 10 minutos sem ser marcado como pronto.`;
  } else {
    alertaEl.style.display = "none";
  }

  const maxPonto = Math.max(...d.porPonto.map((p) => p.total), 1);
  document.getElementById("pontos-venda").innerHTML =
    d.porPonto.length === 0
      ? '<div class="vazio">Nenhum dado no período</div>'
      : d.porPonto
          .map(
            (p) => `
        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px">
            <span class="badge-ponto ${p.ponto_venda === "cima" ? "cima" : p.ponto_venda === "baixo" ? "baixo" : "outro"}">${p.ponto_venda}</span>
            <span style="font-weight:600;font-size:13px;color:var(--cinza)">${p.total} pedido(s)</span>
          </div>
          <div class="barra-fundo">
            <div class="barra-fill" style="width:${Math.round((p.total / maxPonto) * 100)}%"></div>
          </div>
        </div>`,
          )
          .join("");

  document.getElementById("tabela-vendedores").innerHTML =
    d.porVendedor.length === 0
      ? '<tr><td colspan="3" class="vazio">Nenhuma venda no período</td></tr>'
      : d.porVendedor
          .map(
            (v, i) => `
        <tr>
          <td>
            <span style="font-size:11px;color:var(--cinza);margin-right:6px">${i + 1}.</span>
            ${v.vendedor}
          </td>
          <td>${v.total}</td>
          <td class="td-valor">R$ ${(v.faturamento || 0).toFixed(2)}</td>
        </tr>`,
          )
          .join("");
}

async function carregarHistorico(data) {
  const res = await fetchAuth("/api/gestao/historico?data=" + data);
  const pedidos = await res.json();
  document.getElementById("historico").innerHTML =
    pedidos.length === 0
      ? '<div class="vazio">Nenhum pedido no período</div>'
      : pedidos
          .map((p) => {
            const hora = new Date(p.criado_em).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const sc =
              p.status === "pronto"
                ? "pronto"
                : p.status === "em_producao"
                  ? "em_producao"
                  : "aguardando";
            const label =
              p.status === "pronto"
                ? "Pronto"
                : p.status === "em_producao"
                  ? "Em produção"
                  : "Aguardando";
            return `
          <div class="historico-linha">
            <div>
              <div class="historico-numero">${p.numero}</div>
              <div class="historico-info">${p.vendedor_nome} · ${p.ponto_venda} · ${p.tamanho} · ${hora}</div>
            </div>
            <div style="text-align:right">
              <div class="historico-valor">R$ ${parseFloat(p.preco).toFixed(2)}</div>
              <span class="status-pill ${sc}"><span class="dot"></span>${label}</span>
            </div>
          </div>`;
          })
          .join("");
}

async function carregarUsuarios() {
  const res = await fetchAuth("/api/usuarios");
  const usuarios = await res.json();
  document.getElementById("painel-usuarios").innerHTML = `
    <div class="card">
      <h2>Cadastrar usuário</h2>
      <div class="form-grid-2">
        <div class="form-grupo">
          <label class="input-label">Nome</label>
          <input class="input" type="text" id="novo-nome" placeholder="Nome do usuário">
        </div>
        <div class="form-grupo">
          <label class="input-label">Senha</label>
          <input class="input" type="password" id="nova-senha" placeholder="Mín. 8 chars, 1 maiúscula, 1 número">
        </div>
      </div>
      <div style="margin-bottom:14px">
        <label class="input-label" style="margin-bottom:8px">Permissões</label>
        <div class="permissao-check">
          <label><input type="checkbox" id="p-vender"> Vendas</label>
          <label><input type="checkbox" id="p-producao"> Produção</label>
          <label><input type="checkbox" id="p-gestao"> Gestão</label>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <button class="btn btn-primary" onclick="cadastrarUsuario()">Cadastrar</button>
        <span class="msg-feedback" id="msg-cadastro"></span>
      </div>
    </div>

    <div class="card">
      <h2>Usuários cadastrados</h2>
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Vendas</th>
            <th>Produção</th>
            <th>Gestão</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${usuarios
            .map(
              (u) => `
            <tr>
              <td style="font-weight:500">${u.nome}</td>
              <td><input type="checkbox" ${u.pode_vender ? "checked" : ""} onchange="alterarPermissao('${u.id}','pode_vender',this.checked)"></td>
              <td><input type="checkbox" ${u.pode_producao ? "checked" : ""} onchange="alterarPermissao('${u.id}','pode_producao',this.checked)"></td>
              <td><input type="checkbox" ${u.pode_gestao ? "checked" : ""} onchange="alterarPermissao('${u.id}','pode_gestao',this.checked)"></td>
              <td><span class="status-pill ${u.ativo ? "pronto" : "aguardando"}"><span class="dot"></span>${u.ativo ? "Ativo" : "Inativo"}</span></td>
              <td>
                <div class="acoes-td">
                  <button class="btn-tabela" onclick="toggleAtivo('${u.id}',${u.ativo})">${u.ativo ? "Desativar" : "Ativar"}</button>
                  <button class="btn-tabela" onclick="editarSenha('${u.id}')">Senha</button>
                  <button class="btn-tabela perigo" onclick="excluirUsuario('${u.id}','${u.nome}')">Excluir</button>
                </div>
              </td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

async function cadastrarUsuario() {
  const nome = document.getElementById("novo-nome").value.trim();
  const senha = document.getElementById("nova-senha").value.trim();
  const pode_vender = document.getElementById("p-vender").checked;
  const pode_producao = document.getElementById("p-producao").checked;
  const pode_gestao = document.getElementById("p-gestao").checked;
  const msg = document.getElementById("msg-cadastro");

  if (!nome || !senha) {
    setMsg(msg, "Preencha nome e senha", false);
    return;
  }
  if (!pode_vender && !pode_producao && !pode_gestao) {
    setMsg(msg, "Selecione ao menos uma permissão", false);
    return;
  }

  const res = await fetchAuth("/api/usuarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nome,
      senha,
      pode_vender,
      pode_producao,
      pode_gestao,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    setMsg(msg, data.erro, false);
    return;
  }

  setMsg(msg, "Cadastrado com sucesso!", true);
  document.getElementById("novo-nome").value = "";
  document.getElementById("nova-senha").value = "";
  document.getElementById("p-vender").checked = false;
  document.getElementById("p-producao").checked = false;
  document.getElementById("p-gestao").checked = false;
  setTimeout(() => carregarUsuarios(), 800);
}

async function toggleAtivo(id, ativoAtual) {
  await fetchAuth(`/api/usuarios/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ativo: !ativoAtual }),
  });
  carregarUsuarios();
}

async function editarSenha(id) {
  const nova = prompt(
    "Nova senha:\n\n• Mínimo 8 caracteres\n• Uma letra maiúscula\n• Um número",
  );
  if (!nova || !nova.trim()) return;
  const res = await fetchAuth(`/api/usuarios/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ senha: nova.trim() }),
  });
  const data = await res.json();
  if (!res.ok) {
    alert("Erro: " + data.erro);
    return;
  }
  alert("Senha atualizada!");
}

async function alterarPermissao(id, permissao, valor) {
  const res = await fetchAuth(`/api/usuarios/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [permissao]: valor }),
  });
  if (!res.ok) {
    alert("Erro ao alterar permissão");
    carregarUsuarios();
  }
}

async function excluirUsuario(id, nome) {
  if (!confirm(`Excluir o usuário "${nome}"? Esta ação não pode ser desfeita.`))
    return;
  const res = await fetchAuth(`/api/usuarios/${id}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) {
    alert(data.erro);
    return;
  }
  carregarUsuarios();
}

async function carregarProdutosGestao() {
  const res = await fetchAuth("/api/produtos/todos");
  const produtos = await res.json();

  document.getElementById("painel-produtos").innerHTML = `
    <div class="card">
      <h2>Cadastrar produto</h2>
      <div class="form-grid-2" style="align-items:end">
        <div class="form-grupo">
          <label class="input-label">Nome do produto</label>
          <input class="input" type="text" id="prod-nome" placeholder="Ex: Caneca 300ml, Quadro 20×30...">
        </div>
        <div class="form-grupo">
          <label class="input-label">Preço (R$)</label>
          <input class="input" type="text" id="prod-preco" placeholder="0,00">
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
        <button class="btn btn-primary" onclick="cadastrarProduto()">Cadastrar</button>
        <span class="msg-feedback" id="msg-produto"></span>
      </div>
    </div>

    <div class="card">
      <h2>Produtos cadastrados</h2>
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Preço</th>
            <th>Visível</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${
            produtos.length === 0
              ? '<tr><td colspan="4" class="vazio">Nenhum produto cadastrado</td></tr>'
              : produtos
                  .map(
                    (p) => `
                <tr>
                  <td style="font-weight:500">${p.nome}</td>
                  <td>R$ ${parseFloat(p.preco).toFixed(2)}</td>
                  <td>
                    <input type="checkbox" ${p.ativo ? "checked" : ""}
                      onchange="toggleProduto('${p.id}',this.checked)"
                      title="${p.ativo ? "Visível" : "Oculto"}">
                  </td>
                  <td>
                    <div class="acoes-td">
                      <button class="btn-tabela" onclick="editarProduto('${p.id}','${p.nome.replace(/'/g, "\\'")}',${p.preco})">Editar</button>
                      <button class="btn-tabela perigo" onclick="excluirProduto('${p.id}','${p.nome.replace(/'/g, "\\'")}')">Excluir</button>
                    </div>
                  </td>
                </tr>`,
                  )
                  .join("")
          }
        </tbody>
      </table>
    </div>`;
}

async function cadastrarProduto() {
  const nome = document.getElementById("prod-nome").value.trim();
  const preco = parseFloat(
    document.getElementById("prod-preco").value.replace(",", "."),
  );
  const msg = document.getElementById("msg-produto");

  if (!nome) {
    setMsg(msg, "Digite o nome do produto", false);
    return;
  }
  if (isNaN(preco) || preco <= 0) {
    setMsg(msg, "Digite um preço válido", false);
    return;
  }

  const res = await fetchAuth("/api/produtos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome, preco }),
  });
  const data = await res.json();
  if (!res.ok) {
    setMsg(msg, data.erro, false);
    return;
  }

  setMsg(msg, "Produto cadastrado!", true);
  document.getElementById("prod-nome").value = "";
  document.getElementById("prod-preco").value = "";
  setTimeout(() => carregarProdutosGestao(), 800);
}

async function toggleProduto(id, ativo) {
  await fetchAuth(`/api/produtos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ativo }),
  });
}

async function editarProduto(id, nomeAtual, precoAtual) {
  const novoNome = prompt("Nome do produto:", nomeAtual);
  if (novoNome === null) return;
  const novoPreco = prompt("Preço (R$):", precoAtual);
  if (novoPreco === null) return;
  const preco = parseFloat(novoPreco.replace(",", "."));
  if (isNaN(preco) || preco <= 0) {
    alert("Preço inválido");
    return;
  }
  await fetchAuth(`/api/produtos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome: novoNome.trim(), preco }),
  });
  carregarProdutosGestao();
}

async function excluirProduto(id, nome) {
  if (!confirm(`Excluir o produto "${nome}"? Esta ação não pode ser desfeita.`))
    return;
  await fetchAuth(`/api/produtos/${id}`, { method: "DELETE" });
  carregarProdutosGestao();
}

function setMsg(el, texto, ok) {
  el.textContent = texto;
  el.className = "msg-feedback " + (ok ? "ok" : "err");
}
