require("dotenv").config();
const Database = require("better-sqlite3");
const { drizzle } = require("drizzle-orm/better-sqlite3");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const { usuarios, pedidos, produtos } = require("./schema");
const { eq, sql } = require("drizzle-orm");

const sqlite = new Database(path.join(__dirname, "..", "..", "selaron.db"));
const db = drizzle(sqlite);

// cria tabelas se não existirem
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    nome TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    pode_vender INTEGER DEFAULT 0,
    pode_producao INTEGER DEFAULT 0,
    pode_gestao INTEGER DEFAULT 0,
    ativo INTEGER DEFAULT 1,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
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
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS produtos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    preco REAL NOT NULL,
    ativo INTEGER DEFAULT 1,
    ordem INTEGER DEFAULT 0,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

async function seed() {
  const existeUsuario = db.select().from(usuarios).limit(1).all();
  if (existeUsuario.length === 0) {
    const lista = [
      {
        nome: "Matheus",
        senha: "1234",
        vender: 1,
        producao: 1,
        gestao: 1,
      },
      {
        nome: "Producao",
        senha: "Producao1",
        vender: 0,
        producao: 1,
        gestao: 0,
      },
      { nome: "Dono", senha: "Selaron2024", vender: 1, producao: 1, gestao: 1 },
    ];
    for (const u of lista) {
      const hash = await bcrypt.hash(u.senha, 10);
      db.insert(usuarios)
        .values({
          id: uuidv4(),
          nome: u.nome,
          senha_hash: hash,
          pode_vender: u.vender,
          pode_producao: u.producao,
          pode_gestao: u.gestao,
        })
        .run();
    }
    console.log("Usuários iniciais criados");
  }

  const existeProduto = db.select().from(produtos).limit(1).all();
  if (existeProduto.length === 0) {
    const lista = [
      { nome: "Azulejo 10×10 cm", preco: 25 },
      { nome: "Azulejo 15×15 cm", preco: 35 },
      { nome: "Azulejo 20×20 cm", preco: 50 },
      { nome: "Azulejo 20×30 cm", preco: 65 },
      { nome: "Azulejo 30×30 cm", preco: 80 },
      { nome: "Azulejo 30×40 cm", preco: 110 },
    ];
    lista.forEach((p, i) => {
      db.insert(produtos)
        .values({ id: uuidv4(), nome: p.nome, preco: p.preco, ordem: i })
        .run();
    });
    console.log("Produtos iniciais criados");
  }
}

seed();

module.exports = { db, usuarios, pedidos, produtos, sql, eq };
