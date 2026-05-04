require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/usuarios", require("./routes/usuarios"));
app.use("/api/produtos", require("./routes/produtos"));
app.use("/api/pedidos", require("./routes/pedidos"));
app.use("/api/rastrear", require("./routes/pedidos"));
app.use("/api/foto", require("./routes/pedidos"));
app.use("/api/gestao", require("./routes/pedidos"));

app.get("/", (req, res) => res.redirect("/login.html"));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
