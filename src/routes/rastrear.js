require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const { db, pedidos } = require("../db");
const { sql } = require("drizzle-orm");

const router = express.Router();

// RASTREAR — /api/rastrear/:numero
router.get("/:numero", (req, res) => {
  const resultado = db
    .select({
      numero: pedidos.numero,
      tamanho: pedidos.tamanho,
      status: pedidos.status,
      foto: pedidos.foto,
      criado_em: pedidos.criado_em,
    })
    .from(pedidos)
    .where(sql`UPPER(${pedidos.numero}) = UPPER(${req.params.numero})`)
    .all();

  if (resultado.length === 0)
    return res.status(404).json({ erro: "Pedido não encontrado" });
  res.json(resultado[0]);
});

// FOTO — /api/foto/:numero
router.get("/foto/:numero", (req, res) => {
  const resultado = db
    .select({ foto: pedidos.foto })
    .from(pedidos)
    .where(sql`UPPER(${pedidos.numero}) = UPPER(${req.params.numero})`)
    .all();

  if (resultado.length === 0)
    return res.status(404).json({ erro: "Pedido não encontrado" });

  const caminho = path.join(
    __dirname,
    "..",
    "..",
    "uploads",
    resultado[0].foto,
  );
  if (!fs.existsSync(caminho))
    return res.status(404).json({ erro: "Foto não disponível" });

  res.download(caminho, `foto-ceramica-${req.params.numero}.jpg`);
});

module.exports = router;
