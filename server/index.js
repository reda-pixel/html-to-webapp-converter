import express from "express";
import cors from "cors";
import analyzeRouter from "./routes/analyze.js";
import buildRouter from "./routes/build.js";
import githubRouter from "./routes/github.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "html-to-webapp-converter server is running"
  });
});

app.use("/api/analyze", analyzeRouter);
app.use("/api/build", buildRouter);
app.use("/api/github", githubRouter);

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    success: false,
    error: err.message || "Internal server error"
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
