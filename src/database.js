const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const db = new Database(path.join(__dirname, "..", "selaron.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    nome TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    pode_vender INTEGER DEFAULT 0,
    pode_producao INTEGER DEFAULT 0,
    pode_gestao INTEGER DEFAULT 0,
    ativo INTEGER DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pedidos (
    id TEXT PRIMARY KEY,
    numero TEXT UNIQUE NOT NULL,
    vendedor_id TEXT NOT NULL,
    vendedor_nome TEXT NOT NULL,
    ponto_venda TEXT NOT NULL,
    foto TEXT NOT NULL,
    tamanho TEXT NOT NULL,
    preco REAL NOT NULL,
    status TEXT DEFAULT 'aguardando',
    nome_cliente TEXT,
    qr_code TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS produtos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  preco REAL NOT NULL,
  ativo INTEGER DEFAULT 1,
  ordem INTEGER DEFAULT 0,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// cria usuários iniciais se não existirem
const existe = db.prepare("SELECT id FROM usuarios LIMIT 1").get();
if (!existe) {
  const usuarios = [
    {
      nome: "Vendedor Teste",
      senha: "1234",
      vender: 1,
      producao: 0,
      gestao: 0,
    },
    { nome: "Producao", senha: "prod2024", vender: 0, producao: 1, gestao: 0 },
    { nome: "Dono", senha: "dono2024", vender: 1, producao: 1, gestao: 1 },
  ];
  for (const u of usuarios) {
    const hash = bcrypt.hashSync(u.senha, 10);
    db.prepare(
      `
      INSERT INTO usuarios (id, nome, senha_hash, pode_vender, pode_producao, pode_gestao)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    ).run(uuidv4(), u.nome, hash, u.vender, u.producao, u.gestao);
  }
  console.log("Usuários iniciais criados");
}

const produtoExiste = db.prepare("SELECT id FROM produtos LIMIT 1").get();
if (!produtoExiste) {
  const produtos = [
    { nome: "Azulejo 10×10 cm", preco: 25 },
    { nome: "Azulejo 15×15 cm", preco: 35 },
    { nome: "Azulejo 20×20 cm", preco: 50 },
    { nome: "Azulejo 20×30 cm", preco: 65 },
    { nome: "Azulejo 30×30 cm", preco: 80 },
    { nome: "Azulejo 30×40 cm", preco: 110 },
  ];
  produtos.forEach((p, i) => {
    db.prepare(
      "INSERT INTO produtos (id, nome, preco, ordem) VALUES (?, ?, ?, ?)",
    ).run(uuidv4(), p.nome, p.preco, i);
  });
  console.log("Produtos iniciais criados");
}

module.exports = db;
