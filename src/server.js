const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const db = require("./database");

const app = express();
const PORT = 3000;
const JWT_SECRET = "selaron-secret-2024-troque-em-producao";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

const fs = require("fs");

function getPastaHoje() {
  const hoje = new Date().toISOString().slice(0, 10);
  const pasta = path.join(__dirname, "..", "uploads", hoje);
  if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
  return pasta;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, getPastaHoje()),
  filename: (req, file, cb) =>
    cb(null, uuidv4() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// middleware de autenticação
function autenticar(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer "))
    return res.status(401).json({ erro: "Não autenticado" });
  try {
    req.usuario = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: "Token inválido ou expirado" });
  }
}

function exigir(permissao) {
  return (req, res, next) => {
    if (!req.usuario[permissao])
      return res.status(403).json({ erro: "Sem permissão" });
    next();
  };
}

function gerarNumero() {
  const sortear = (chars, qtd) =>
    Array.from(
      { length: qtd },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");

  const letras = sortear("ABCDEFGHJKLMNPQRSTUVWXYZ", 3);
  const nums = sortear("0123456789", 3);

  return `${letras}${nums}`;
}

function validarSenha(senha) {
  if (senha.length < 8) return "A senha deve ter pelo menos 8 caracteres";
  if (!/[A-Z]/.test(senha))
    return "A senha deve ter pelo menos uma letra maiúscula";
  if (!/[0-9]/.test(senha)) return "A senha deve ter pelo menos um número";
  return null;
}

// LOGIN
app.post("/api/login", async (req, res) => {
  const { nome, senha } = req.body;
  const usuario = db
    .prepare(
      "SELECT * FROM usuarios WHERE LOWER(nome) = LOWER(?) AND ativo = 1",
    )
    .get(nome);
  if (!usuario)
    return res.status(401).json({ erro: "Nome ou senha incorretos" });

  const senhaOk = await bcrypt.compare(senha, usuario.senha_hash);
  if (!senhaOk)
    return res.status(401).json({ erro: "Nome ou senha incorretos" });

  const payload = {
    id: usuario.id,
    nome: usuario.nome,
    pode_vender: !!usuario.pode_vender,
    pode_producao: !!usuario.pode_producao,
    pode_gestao: !!usuario.pode_gestao,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
  res.json({ token, usuario: payload });
});

// CRIAR PEDIDO
app.post(
  "/api/pedidos",
  autenticar,
  exigir("pode_vender"),
  upload.single("foto"),
  async (req, res) => {
    const { ponto_venda, tamanho, preco, nome_cliente } = req.body;
    if (!req.file) return res.status(400).json({ erro: "Foto obrigatória" });

    const id = uuidv4();
    let numero = gerarNumero();
    while (db.prepare("SELECT id FROM pedidos WHERE numero = ?").get(numero)) {
      numero = gerarNumero();
    }

    const baseUrl = `http://${req.hostname}:${PORT}`;
    const urlRastreio = `${baseUrl}/rastrear.html?pedido=${numero}`;
    const qrDataUrl = await QRCode.toDataURL(urlRastreio, {
      width: 300,
      margin: 2,
    });

    const hoje = new Date().toISOString().slice(0, 10);
    const nomeArquivo = hoje + "/" + req.file.filename;

    db.prepare(
      `
  INSERT INTO pedidos (id, numero, vendedor_id, vendedor_nome, ponto_venda, foto, tamanho, preco, nome_cliente, qr_code)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
    ).run(
      id,
      numero,
      req.usuario.id,
      req.usuario.nome,
      ponto_venda,
      nomeArquivo,
      tamanho,
      preco,
      nome_cliente || null,
      qrDataUrl,
    );

    res.json({ id, numero, qrCode: qrDataUrl, urlRastreio });
  },
);

// LISTAR PEDIDOS (produção)
app.get("/api/pedidos", autenticar, exigir("pode_producao"), (req, res) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const pedidos = db
    .prepare(
      `
    SELECT * FROM pedidos
    WHERE status = 'aguardando' AND DATE(criado_em) = ?
    ORDER BY criado_em ASC
  `,
    )
    .all(hoje);
  res.json(pedidos);
});

// ATUALIZAR STATUS
app.patch(
  "/api/pedidos/:id/status",
  autenticar,
  exigir("pode_producao"),
  (req, res) => {
    const { status } = req.body;
    const statusValidos = ["aguardando", "em_producao", "pronto"];
    if (!statusValidos.includes(status))
      return res.status(400).json({ erro: "Status inválido" });
    db.prepare(
      "UPDATE pedidos SET status = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
    ).run(status, req.params.id);
    res.json({ ok: true });
  },
);

// RASTREAR (público, sem autenticação)
app.get("/api/rastrear/:numero", (req, res) => {
  const pedido = db
    .prepare(
      "SELECT numero, tamanho, status, foto, criado_em FROM pedidos WHERE numero = ?",
    )
    .get(req.params.numero.toUpperCase());
  if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado" });
  res.json(pedido);
});

// GESTÃO — RESUMO
app.get("/api/gestao/resumo", autenticar, exigir("pode_gestao"), (req, res) => {
  const data = req.query.data || new Date().toISOString().slice(0, 10);
  const hoje = new Date().toISOString().slice(0, 10);
  const totalDia = db
    .prepare(
      `SELECT COUNT(*) as total, SUM(preco) as faturamento FROM pedidos WHERE DATE(criado_em) = ?`,
    )
    .get(data);
  const porVendedor = db
    .prepare(
      `SELECT vendedor_nome as vendedor, COUNT(*) as total, SUM(preco) as faturamento FROM pedidos WHERE DATE(criado_em) = ? GROUP BY vendedor_nome ORDER BY total DESC`,
    )
    .all(data);
  const porPonto = db
    .prepare(
      `SELECT ponto_venda, COUNT(*) as total FROM pedidos WHERE DATE(criado_em) = ? GROUP BY ponto_venda`,
    )
    .all(data);
  const atrasados = db
    .prepare(
      `SELECT COUNT(*) as total FROM pedidos WHERE status = 'aguardando' AND DATE(criado_em) = ? AND (JULIANDAY('now') - JULIANDAY(criado_em)) * 1440 > 10`,
    )
    .get(hoje);
  res.json({ totalDia, porVendedor, porPonto, atrasados });
});

// GESTÃO — HISTÓRICO
app.get(
  "/api/gestao/historico",
  autenticar,
  exigir("pode_gestao"),
  (req, res) => {
    const data = req.query.data || new Date().toISOString().slice(0, 10);
    const pedidos = db
      .prepare(
        `SELECT * FROM pedidos WHERE DATE(criado_em) = ? ORDER BY criado_em DESC`,
      )
      .all(data);
    res.json(pedidos);
  },
);

// GESTÃO — LISTAR USUÁRIOS
app.get("/api/usuarios", autenticar, exigir("pode_gestao"), (req, res) => {
  const usuarios = db
    .prepare(
      "SELECT id, nome, pode_vender, pode_producao, pode_gestao, ativo, criado_em FROM usuarios ORDER BY nome",
    )
    .all();
  res.json(usuarios);
});

// GESTÃO — CADASTRAR USUÁRIO
app.post(
  "/api/usuarios",
  autenticar,
  exigir("pode_gestao"),
  async (req, res) => {
    const { nome, senha, pode_vender, pode_producao, pode_gestao } = req.body;
    if (!nome || !senha)
      return res.status(400).json({ erro: "Nome e senha obrigatórios" });
    const erroSenha = validarSenha(senha);
    if (erroSenha) return res.status(400).json({ erro: erroSenha });
    const existe = db
      .prepare("SELECT id FROM usuarios WHERE nome = ?")
      .get(nome);
    if (existe)
      return res
        .status(400)
        .json({ erro: "Já existe um usuário com esse nome" });
    const hash = await bcrypt.hash(senha, 10);
    const id = uuidv4();
    db.prepare(
      `
    INSERT INTO usuarios (id, nome, senha_hash, pode_vender, pode_producao, pode_gestao)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    ).run(
      id,
      nome,
      hash,
      pode_vender ? 1 : 0,
      pode_producao ? 1 : 0,
      pode_gestao ? 1 : 0,
    );
    res.json({ id });
  },
);

// GESTÃO — EDITAR USUÁRIO
app.patch(
  "/api/usuarios/:id",
  autenticar,
  exigir("pode_gestao"),
  async (req, res) => {
    const { senha, pode_vender, pode_producao, pode_gestao, ativo } = req.body;
    const { id } = req.params;

    try {
      // --- VALIDAÇÃO E ATUALIZAÇÃO DA SENHA ---
      if (senha) {
        // Chama a função de validação antes de qualquer processamento pesado
        const erroSenha = validarSenha(senha);
        if (erroSenha) {
          return res.status(400).json({ erro: erroSenha });
        }

        // Gera o hash apenas se a senha for válida
        const hash = await bcrypt.hash(senha, 10);
        db.prepare("UPDATE usuarios SET senha_hash = ? WHERE id = ?").run(
          hash,
          id,
        );
      }

      // --- ATUALIZAÇÃO DAS PERMISSÕES E STATUS ---
      // Usamos '!== undefined' para permitir valores booleanos (false/0)
      if (pode_vender !== undefined) {
        db.prepare("UPDATE usuarios SET pode_vender = ? WHERE id = ?").run(
          pode_vender ? 1 : 0,
          id,
        );
      }

      if (pode_producao !== undefined) {
        db.prepare("UPDATE usuarios SET pode_producao = ? WHERE id = ?").run(
          pode_producao ? 1 : 0,
          id,
        );
      }

      if (pode_gestao !== undefined) {
        db.prepare("UPDATE usuarios SET pode_gestao = ? WHERE id = ?").run(
          pode_gestao ? 1 : 0,
          id,
        );
      }

      if (ativo !== undefined) {
        db.prepare("UPDATE usuarios SET ativo = ? WHERE id = ?").run(
          ativo ? 1 : 0,
          id,
        );
      }

      // Retorna sucesso se chegar até aqui
      res.json({ ok: true, mensagem: "Usuário atualizado com sucesso" });
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      res.status(500).json({ erro: "Erro interno ao atualizar usuário" });
    }
  },
);

app.get("/", (req, res) => res.redirect("/login.html"));

// EXCLUIR USUÁRIO
app.delete(
  "/api/usuarios/:id",
  autenticar,
  exigir("pode_gestao"),
  (req, res) => {
    const usuario = db
      .prepare("SELECT nome FROM usuarios WHERE id = ?")
      .get(req.params.id);
    if (!usuario)
      return res.status(404).json({ erro: "Usuário não encontrado" });
    if (usuario.nome === "Dono")
      return res
        .status(400)
        .json({ erro: "Não é possível excluir o usuário Dono" });
    db.prepare("DELETE FROM usuarios WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  },
);

// FOTO DO PEDIDO (pública, acessada pelo código)
app.get("/api/foto/:numero", (req, res) => {
  const pedido = db
    .prepare("SELECT foto FROM pedidos WHERE numero = ?")
    .get(req.params.numero.toUpperCase());
  if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado" });

  const caminho = path.join(__dirname, "..", "uploads", pedido.foto);
  if (!fs.existsSync(caminho))
    return res.status(404).json({ erro: "Foto não disponível" });

  res.download(caminho, `selaron-${req.params.numero}.jpg`);
});

// KANBAN (produção) — novos, em produção e prontos do dia
app.get(
  "/api/pedidos/kanban",
  autenticar,
  exigir("pode_producao"),
  (req, res) => {
    const hoje = new Date().toISOString().slice(0, 10);

    const novos = db
      .prepare(
        `
    SELECT * FROM pedidos WHERE status = 'aguardando' AND DATE(criado_em) = ?
    ORDER BY criado_em ASC
  `,
      )
      .all(hoje);

    const emProducao = db
      .prepare(
        `
    SELECT * FROM pedidos WHERE status = 'em_producao' AND DATE(criado_em) = ?
    ORDER BY criado_em ASC
  `,
      )
      .all(hoje);

    const prontos = db
      .prepare(
        `
    SELECT * FROM pedidos WHERE status = 'pronto' AND DATE(criado_em) = ?
    ORDER BY atualizado_em DESC
  `,
      )
      .all(hoje);

    res.json({ novos, emProducao, prontos });
  },
);

// LISTAR PRODUTOS (público para vendedor)
app.get("/api/produtos", autenticar, (req, res) => {
  const produtos = db
    .prepare("SELECT * FROM produtos WHERE ativo = 1 ORDER BY ordem, nome")
    .all();
  res.json(produtos);
});

// LISTAR TODOS PRODUTOS (gestão)
app.get(
  "/api/produtos/todos",
  autenticar,
  exigir("pode_gestao"),
  (req, res) => {
    const produtos = db
      .prepare("SELECT * FROM produtos ORDER BY ordem, nome")
      .all();
    res.json(produtos);
  },
);

// CRIAR PRODUTO
app.post("/api/produtos", autenticar, exigir("pode_gestao"), (req, res) => {
  const { nome, preco } = req.body;
  if (!nome || preco === undefined)
    return res.status(400).json({ erro: "Nome e preço obrigatórios" });
  const id = uuidv4();
  const ordem = db
    .prepare("SELECT COUNT(*) as total FROM produtos")
    .get().total;
  db.prepare(
    "INSERT INTO produtos (id, nome, preco, ordem) VALUES (?, ?, ?, ?)",
  ).run(id, nome, parseFloat(preco), ordem);
  res.json({ id });
});

// EDITAR PRODUTO
app.patch(
  "/api/produtos/:id",
  autenticar,
  exigir("pode_gestao"),
  (req, res) => {
    const { nome, preco, ativo } = req.body;
    if (nome !== undefined)
      db.prepare("UPDATE produtos SET nome = ? WHERE id = ?").run(
        nome,
        req.params.id,
      );
    if (preco !== undefined)
      db.prepare("UPDATE produtos SET preco = ? WHERE id = ?").run(
        parseFloat(preco),
        req.params.id,
      );
    if (ativo !== undefined)
      db.prepare("UPDATE produtos SET ativo = ? WHERE id = ?").run(
        ativo ? 1 : 0,
        req.params.id,
      );
    res.json({ ok: true });
  },
);

// EXCLUIR PRODUTO
app.delete(
  "/api/produtos/:id",
  autenticar,
  exigir("pode_gestao"),
  (req, res) => {
    db.prepare("DELETE FROM produtos WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  },
);

// CRIAR PEDIDO EM LOTE (carrinho)
app.post(
  "/api/pedidos/lote",
  autenticar,
  exigir("pode_vender"),
  upload.single("foto"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ erro: "Foto obrigatória" });

    let itens;
    try {
      itens = JSON.parse(req.body.itens);
    } catch {
      return res.status(400).json({ erro: "Itens inválidos" });
    }

    if (!itens || itens.length === 0)
      return res.status(400).json({ erro: "Carrinho vazio" });

    const hoje = new Date().toISOString().slice(0, 10);
    const nomeArquivo = hoje + "/" + req.file.filename;
    const { ponto_venda, nome_cliente } = req.body;
    const pedidosCriados = [];

    for (const item of itens) {
      for (let q = 0; q < item.quantidade; q++) {
        const id = uuidv4();
        let numero = gerarNumero();
        while (
          db.prepare("SELECT id FROM pedidos WHERE numero = ?").get(numero)
        ) {
          numero = gerarNumero();
        }

        const baseUrl = `http://${req.hostname}:${PORT}`;
        const urlRastreio = `${baseUrl}/rastrear.html?pedido=${numero}`;
        const qrDataUrl = await QRCode.toDataURL(urlRastreio, {
          width: 300,
          margin: 2,
        });

        db.prepare(
          `
        INSERT INTO pedidos (id, numero, vendedor_id, vendedor_nome, ponto_venda, foto, tamanho, preco, nome_cliente, qr_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        ).run(
          id,
          numero,
          req.usuario.id,
          req.usuario.nome,
          ponto_venda,
          nomeArquivo,
          item.nome,
          item.preco,
          nome_cliente || null,
          qrDataUrl,
        );

        pedidosCriados.push({
          id,
          numero,
          qrCode: qrDataUrl,
          produto: item.nome,
        });
      }
    }

    res.json({ pedidos: pedidosCriados });
  },
);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
