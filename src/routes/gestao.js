require("dotenv").config();
const express = require("express");
const { db, pedidos } = require("../db");
const { sql } = require("drizzle-orm");
const { autenticar, exigir } = require("../middleware/auth");

const router = express.Router();

router.get("/resumo", autenticar, exigir("pode_gestao"), (req, res) => {
  const data = req.query.data || new Date().toISOString().slice(0, 10);
  const hoje = new Date().toISOString().slice(0, 10);

  const totalDia = db
    .select({
      total: sql`COUNT(*)`,
      faturamento: sql`SUM(${pedidos.preco})`,
    })
    .from(pedidos)
    .where(sql`DATE(${pedidos.criado_em}) = ${data}`)
    .all()[0];

  const porVendedor = db
    .select({
      vendedor: pedidos.vendedor_nome,
      total: sql`COUNT(*)`,
      faturamento: sql`SUM(${pedidos.preco})`,
    })
    .from(pedidos)
    .where(sql`DATE(${pedidos.criado_em}) = ${data}`)
    .groupBy(pedidos.vendedor_nome)
    .orderBy(sql`COUNT(*) DESC`)
    .all();

  const porPonto = db
    .select({
      ponto_venda: pedidos.ponto_venda,
      total: sql`COUNT(*)`,
    })
    .from(pedidos)
    .where(sql`DATE(${pedidos.criado_em}) = ${data}`)
    .groupBy(pedidos.ponto_venda)
    .all();

  const atrasados = db
    .select({
      total: sql`COUNT(*)`,
    })
    .from(pedidos)
    .where(
      sql`
      ${pedidos.status} = 'aguardando'
      AND DATE(${pedidos.criado_em}) = ${hoje}
      AND (JULIANDAY('now') - JULIANDAY(${pedidos.criado_em})) * 1440 > 10
    `,
    )
    .all()[0];

  res.json({ totalDia, porVendedor, porPonto, atrasados });
});

router.get("/historico", autenticar, exigir("pode_gestao"), (req, res) => {
  const data = req.query.data || new Date().toISOString().slice(0, 10);
  const lista = db
    .select()
    .from(pedidos)
    .where(sql`DATE(${pedidos.criado_em}) = ${data}`)
    .orderBy(sql`${pedidos.criado_em} DESC`)
    .all();
  res.json(lista);
});

module.exports = router;
