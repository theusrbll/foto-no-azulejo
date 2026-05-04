require("dotenv").config();
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

function autenticar(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Não autenticado" });
  }
  try {
    req.usuario = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: "Token inválido ou expirado" });
  }
}

function exigir(permissao) {
  return (req, res, next) => {
    if (!req.usuario[permissao]) {
      return res.status(403).json({ erro: "Sem permissão" });
    }
    next();
  };
}

function validarSenha(senha) {
  if (senha.length < 8) return "A senha deve ter pelo menos 8 caracteres";
  if (!/[A-Z]/.test(senha))
    return "A senha deve ter pelo menos uma letra maiúscula";
  if (!/[0-9]/.test(senha)) return "A senha deve ter pelo menos um número";
  return null;
}

module.exports = { autenticar, exigir, validarSenha };
