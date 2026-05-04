const express = require("express");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const { db, usuarios } = require("../db");
const { eq, sql } = require("drizzle-orm");
const { autenticar, exigir, validarSenha } = require("../middleware/auth");

const router = express.Router();

router.get("/", autenticar, exigir("pode_gestao"), (req, res) => {
  const lista = db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      pode_vender: usuarios.pode_vender,
      pode_producao: usuarios.pode_producao,
      pode_gestao: usuarios.pode_gestao,
      ativo: usuarios.ativo,
      criado_em: usuarios.criado_em,
    })
    .from(usuarios)
    .orderBy(usuarios.nome)
    .all();
  res.json(lista);
});

router.post("/", autenticar, exigir("pode_gestao"), async (req, res) => {
  const { nome, senha, pode_vender, pode_producao, pode_gestao } = req.body;
  if (!nome || !senha)
    return res.status(400).json({ erro: "Nome e senha obrigatórios" });

  const erroSenha = validarSenha(senha);
  if (erroSenha) return res.status(400).json({ erro: erroSenha });

  const existe = db
    .select()
    .from(usuarios)
    .where(sql`LOWER(${usuarios.nome}) = LOWER(${nome})`)
    .all();
  if (existe.length > 0)
    return res.status(400).json({ erro: "Já existe um usuário com esse nome" });

  const hash = await bcrypt.hash(senha, 10);
  const id = uuidv4();
  db.insert(usuarios)
    .values({
      id,
      nome,
      senha_hash: hash,
      pode_vender: pode_vender ? 1 : 0,
      pode_producao: pode_producao ? 1 : 0,
      pode_gestao: pode_gestao ? 1 : 0,
    })
    .run();

  res.json({ id });
});

router.patch("/:id", autenticar, exigir("pode_gestao"), async (req, res) => {
  const { senha, pode_vender, pode_producao, pode_gestao, ativo } = req.body;

  if (senha !== undefined) {
    const erroSenha = validarSenha(senha);
    if (erroSenha) return res.status(400).json({ erro: erroSenha });
    const hash = await bcrypt.hash(senha, 10);
    db.update(usuarios)
      .set({ senha_hash: hash })
      .where(eq(usuarios.id, req.params.id))
      .run();
  }
  if (pode_vender !== undefined)
    db.update(usuarios)
      .set({ pode_vender: pode_vender ? 1 : 0 })
      .where(eq(usuarios.id, req.params.id))
      .run();
  if (pode_producao !== undefined)
    db.update(usuarios)
      .set({ pode_producao: pode_producao ? 1 : 0 })
      .where(eq(usuarios.id, req.params.id))
      .run();
  if (pode_gestao !== undefined)
    db.update(usuarios)
      .set({ pode_gestao: pode_gestao ? 1 : 0 })
      .where(eq(usuarios.id, req.params.id))
      .run();
  if (ativo !== undefined)
    db.update(usuarios)
      .set({ ativo: ativo ? 1 : 0 })
      .where(eq(usuarios.id, req.params.id))
      .run();

  res.json({ ok: true });
});

router.delete("/:id", autenticar, exigir("pode_gestao"), (req, res) => {
  const usuario = db
    .select()
    .from(usuarios)
    .where(eq(usuarios.id, req.params.id))
    .all()[0];
  if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado" });
  if (usuario.nome.toLowerCase() === "dono")
    return res
      .status(400)
      .json({ erro: "Não é possível excluir o usuário Dono" });
  db.delete(usuarios).where(eq(usuarios.id, req.params.id)).run();
  res.json({ ok: true });
});

module.exports = router;
