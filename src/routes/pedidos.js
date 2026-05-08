require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const QRCode = require("qrcode");
const { db, pedidos } = require("../db");
const { eq, sql } = require("drizzle-orm");
const { autenticar, exigir } = require("../middleware/auth");

const router = express.Router();
const PORT = process.env.PORT || 3000;

const TIPOS_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

function getPastaHoje() {
  const hoje = new Date().toISOString().slice(0, 10);
  const pasta = path.join(__dirname, "..", "..", "uploads", hoje);
  if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
  return pasta;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, getPastaHoje()),
  filename: (req, file, cb) =>
    cb(null, uuidv4() + path.extname(file.originalname)),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (TIPOS_PERMITIDOS.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Tipo de arquivo não permitido. Envie apenas imagens."));
  },
  limits: { fileSize: 15 * 1024 * 1024 },
});

function gerarNumero() {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const nums = "0123456789";
  let codigo = "";
  for (let i = 0; i < 3; i++)
    codigo += letras[Math.floor(Math.random() * letras.length)];
  for (let i = 0; i < 3; i++)
    codigo += nums[Math.floor(Math.random() * nums.length)];
  return codigo;
}

// CRIAR PEDIDO EM LOTE
router.post(
  "/lote",
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

    // usa BASE_URL do .env para o QR code funcionar no celular
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;

    for (const item of itens) {
      for (let q = 0; q < item.quantidade; q++) {
        const id = uuidv4();
        let numero = gerarNumero();
        while (
          db.select().from(pedidos).where(eq(pedidos.numero, numero)).all()
            .length > 0
        ) {
          numero = gerarNumero();
        }

        const urlRastreio = `${baseUrl}/rastrear.html?pedido=${numero}`;
        const qrDataUrl = await QRCode.toDataURL(urlRastreio, {
          width: 300,
          margin: 2,
        });

        db.insert(pedidos)
          .values({
            id,
            numero,
            vendedor_id: req.usuario.id,
            vendedor_nome: req.usuario.nome,
            ponto_venda,
            foto: nomeArquivo,
            tamanho: item.nome,
            preco: item.preco,
            nome_cliente: nome_cliente || null,
            qr_code: qrDataUrl,
            criado_em: new Date().toISOString(),
            atualizado_em: new Date().toISOString(),
          })
          .run();

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

// KANBAN
router.get("/kanban", autenticar, exigir("pode_producao"), (req, res) => {
  const hoje = new Date().toISOString().slice(0, 10);

  const novos = db
    .select()
    .from(pedidos)
    .where(
      sql`${pedidos.status} = 'aguardando' AND DATE(${pedidos.criado_em}) = ${hoje}`,
    )
    .orderBy(pedidos.criado_em)
    .all();

  const emProducao = db
    .select()
    .from(pedidos)
    .where(
      sql`${pedidos.status} = 'em_producao' AND DATE(${pedidos.criado_em}) = ${hoje}`,
    )
    .orderBy(pedidos.criado_em)
    .all();

  const prontos = db
    .select()
    .from(pedidos)
    .where(
      sql`${pedidos.status} = 'pronto' AND DATE(${pedidos.criado_em}) = ${hoje}`,
    )
    .orderBy(sql`${pedidos.atualizado_em} DESC`)
    .all();

  res.json({ novos, emProducao, prontos });
});

// ATUALIZAR STATUS
router.patch("/:id/status", autenticar, exigir("pode_producao"), (req, res) => {
  const { status } = req.body;
  const statusValidos = ["aguardando", "em_producao", "pronto"];
  if (!statusValidos.includes(status))
    return res.status(400).json({ erro: "Status inválido" });

  db.update(pedidos)
    .set({
      status,
      atualizado_em: new Date().toISOString(),
    })
    .where(eq(pedidos.id, req.params.id))
    .run();

  res.json({ ok: true });
});

// LIMPEZA DE UPLOADS ANTIGOS
function limparUploadsAntigos() {
  const pastaBase = path.join(__dirname, "..", "..", "uploads");
  if (!fs.existsSync(pastaBase)) return;
  const limite = new Date();
  limite.setDate(limite.getDate() - 2);
  const dataLimite = limite.toISOString().slice(0, 10);
  fs.readdirSync(pastaBase).forEach((pasta) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pasta)) return;
    if (pasta < dataLimite) {
      fs.rmSync(path.join(pastaBase, pasta), { recursive: true, force: true });
      console.log(`Pasta removida: ${pasta}`);
    }
  });
}

limparUploadsAntigos();
setInterval(limparUploadsAntigos, 24 * 60 * 60 * 1000);

module.exports = router;
