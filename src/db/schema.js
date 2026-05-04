const { sqliteTable, text, real, integer } = require("drizzle-orm/sqlite-core");

const usuarios = sqliteTable("usuarios", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull().unique(),
  senha_hash: text("senha_hash").notNull(),
  pode_vender: integer("pode_vender").default(0),
  pode_producao: integer("pode_producao").default(0),
  pode_gestao: integer("pode_gestao").default(0),
  ativo: integer("ativo").default(1),
  criado_em: text("criado_em").default(new Date().toISOString()),
});

const pedidos = sqliteTable("pedidos", {
  id: text("id").primaryKey(),
  numero: text("numero").notNull().unique(),
  vendedor_id: text("vendedor_id").notNull(),
  vendedor_nome: text("vendedor_nome").notNull(),
  ponto_venda: text("ponto_venda").notNull(),
  foto: text("foto").notNull(),
  tamanho: text("tamanho").notNull(),
  preco: real("preco").notNull(),
  status: text("status").default("aguardando"),
  nome_cliente: text("nome_cliente"),
  qr_code: text("qr_code"),
  criado_em: text("criado_em").default(new Date().toISOString()),
  atualizado_em: text("atualizado_em").default(new Date().toISOString()),
});

const produtos = sqliteTable("produtos", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  preco: real("preco").notNull(),
  ativo: integer("ativo").default(1),
  ordem: integer("ordem").default(0),
  criado_em: text("criado_em").default(new Date().toISOString()),
});

module.exports = { usuarios, pedidos, produtos };
