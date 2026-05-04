const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { db, produtos } = require("../db");
const { eq, sql } = require("drizzle-orm");
const { autenticar, exigir } = require("../middleware/auth");

const router = express.Router();

router.get("/", autenticar, (req, res) => {
  const lista = db
    .select()
    .from(produtos)
    .where(eq(produtos.ativo, 1))
    .orderBy(produtos.ordem, produtos.nome)
    .all();
  res.json(lista);
});

router.get("/todos", autenticar, exigir("pode_gestao"), (req, res) => {
  const lista = db
    .select()
    .from(produtos)
    .orderBy(produtos.ordem, produtos.nome)
    .all();
  res.json(lista);
});

router.post("/", autenticar, exigir("pode_gestao"), (req, res) => {
  const { nome, preco } = req.body;
  if (!nome || preco === undefined)
    return res.status(400).json({ erro: "Nome e preço obrigatórios" });
  const total = db.select().from(produtos).all().length;
  const id = uuidv4();
  db.insert(produtos)
    .values({ id, nome, preco: parseFloat(preco), ordem: total })
    .run();
  res.json({ id });
});

router.patch("/:id", autenticar, exigir("pode_gestao"), (req, res) => {
  const { nome, preco, ativo } = req.body;
  if (nome !== undefined)
    db.update(produtos)
      .set({ nome })
      .where(eq(produtos.id, req.params.id))
      .run();
  if (preco !== undefined)
    db.update(produtos)
      .set({ preco: parseFloat(preco) })
      .where(eq(produtos.id, req.params.id))
      .run();
  if (ativo !== undefined)
    db.update(produtos)
      .set({ ativo: ativo ? 1 : 0 })
      .where(eq(produtos.id, req.params.id))
      .run();
  res.json({ ok: true });
});

router.delete("/:id", autenticar, exigir("pode_gestao"), (req, res) => {
  db.delete(produtos).where(eq(produtos.id, req.params.id)).run();
  res.json({ ok: true });
});

module.exports = router;
