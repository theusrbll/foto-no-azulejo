require("dotenv").config();
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { db, usuarios } = require("../db");
const { eq, sql } = require("drizzle-orm");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// mapa de tentativas por IP
const tentativas = new Map();
const LIMITE_TENTATIVAS = 5;
const JANELA_MS = 15 * 60 * 1000; // 15 minutos

function checarBloqueio(ip) {
  const agora = Date.now();
  const registro = tentativas.get(ip);
  if (!registro) return false;
  if (agora - registro.inicio > JANELA_MS) {
    tentativas.delete(ip);
    return false;
  }
  return registro.count >= LIMITE_TENTATIVAS;
}

function registrarTentativa(ip) {
  const agora = Date.now();
  const registro = tentativas.get(ip);
  if (!registro || agora - registro.inicio > JANELA_MS) {
    tentativas.set(ip, { count: 1, inicio: agora });
  } else {
    registro.count++;
  }
}

function limparTentativas(ip) {
  tentativas.delete(ip);
}

router.post("/login", async (req, res) => {
  const ip = req.ip;

  if (checarBloqueio(ip)) {
    return res
      .status(429)
      .json({ erro: "Muitas tentativas. Aguarde 15 minutos." });
  }

  const { nome, senha } = req.body;
  if (!nome || !senha)
    return res.status(400).json({ erro: "Nome e senha obrigatórios" });

  const resultado = db
    .select()
    .from(usuarios)
    .where(
      sql`LOWER(${usuarios.nome}) = LOWER(${nome}) AND ${usuarios.ativo} = 1`,
    )
    .all();

  const usuario = resultado[0];

  if (!usuario) {
    registrarTentativa(ip);
    return res.status(401).json({ erro: "Nome ou senha incorretos" });
  }

  const senhaOk = await bcrypt.compare(senha, usuario.senha_hash);
  if (!senhaOk) {
    registrarTentativa(ip);
    return res.status(401).json({ erro: "Nome ou senha incorretos" });
  }

  limparTentativas(ip);

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

module.exports = router;
