/* Names copied from index.html. Each tool once per mode. */

export const layers = [
  { id: "data", name: "Data" },
  { id: "models", name: "Models" },
  { id: "retrieval", name: "Retrieval" },
  { id: "orchestration", name: "Orchestration" },
  { id: "serving", name: "Serving" },
  { id: "observability", name: "Observability" },
  { id: "visualisation", name: "Visualisation" },
];

export const uses = [
  { id: "b4igo", name: "B4iGo" },
  { id: "infravision", name: "InfraVision AI" },
  { id: "fabric", name: "Infobell Agentic Fabric" },
  { id: "codework", name: "CODEWORK" },
  { id: "stress", name: "Stress Detection" },
  { id: "feynn", name: "Feynn Labs" },
  { id: "also", name: "Also in the stack" },
];

export const tools = [
  { id: "mysql", name: "MySQL", layer: "data", use: "stress", useIndex: 2 },
  { id: "postgresql", name: "PostgreSQL", layer: "data", use: "also", useIndex: 0 },
  { id: "mongodb", name: "MongoDB", layer: "data", use: "also", useIndex: 1 },
  { id: "hadoop", name: "Apache Hadoop", layer: "data", use: "also", useIndex: 2 },
  { id: "hive", name: "Hive", layer: "data", use: "also", useIndex: 3 },
  { id: "sqoop", name: "Sqoop", layer: "data", use: "also", useIndex: 4 },
  { id: "spark", name: "Spark", layer: "data", use: "also", useIndex: 5 },
  { id: "kafka", name: "Kafka", layer: "data", use: "also", useIndex: 6 },

  { id: "pytorch", name: "PyTorch", layer: "models", use: "also", useIndex: 7 },
  { id: "tensorflow", name: "TensorFlow", layer: "models", use: "also", useIndex: 8 },
  { id: "keras", name: "Keras", layer: "models", use: "also", useIndex: 9 },
  { id: "scikit-learn", name: "Scikit-learn", layer: "models", use: "feynn", useIndex: 4 },
  { id: "gemini", name: "Gemini 2.0 Flash", layer: "models", use: "codework", useIndex: 0 },
  { id: "llama-3", name: "LLaMA 3", layer: "models", use: "codework", useIndex: 1 },
  { id: "esrgan", name: "ESRGAN", layer: "models", use: "codework", useIndex: 2 },
  { id: "tesseract", name: "Tesseract OCR", layer: "models", use: "codework", useIndex: 3 },
  { id: "ann", name: "ANN", layer: "models", use: "stress", useIndex: 0 },
  { id: "linear-regression", name: "Linear Regression", layer: "models", use: "feynn", useIndex: 0 },
  { id: "random-forest", name: "Random Forest", layer: "models", use: "feynn", useIndex: 1 },
  { id: "pca", name: "PCA", layer: "models", use: "feynn", useIndex: 2 },
  { id: "k-means", name: "K\u2011Means", layer: "models", use: "feynn", useIndex: 3 },

  { id: "rag", name: "RAG", layer: "retrieval", use: "b4igo", useIndex: 0 },
  { id: "pinecone", name: "Pinecone", layer: "retrieval", use: "also", useIndex: 10 },
  { id: "chromadb", name: "ChromaDB", layer: "retrieval", use: "also", useIndex: 11 },

  { id: "langchain", name: "LangChain", layer: "orchestration", use: "also", useIndex: 12 },
  { id: "langgraph", name: "LangGraph", layer: "orchestration", use: "infravision", useIndex: 1 },
  { id: "mcp", name: "MCP", layer: "orchestration", use: "also", useIndex: 13 },

  { id: "python", name: "Python", layer: "serving", use: "fabric", useIndex: 0 },
  { id: "fastapi", name: "FastAPI", layer: "serving", use: "infravision", useIndex: 0 },
  { id: "django", name: "Django", layer: "serving", use: "stress", useIndex: 1 },
  { id: "docker", name: "Docker", layer: "serving", use: "also", useIndex: 14 },
  { id: "kubernetes", name: "Kubernetes", layer: "serving", use: "also", useIndex: 15 },
  { id: "jenkins", name: "Jenkins", layer: "serving", use: "also", useIndex: 16 },

  { id: "prometheus", name: "Prometheus", layer: "observability", use: "also", useIndex: 17 },
  { id: "grafana", name: "Grafana", layer: "observability", use: "also", useIndex: 18 },
  { id: "opentelemetry", name: "OpenTelemetry", layer: "observability", use: "fabric", useIndex: 1 },

  { id: "matplotlib", name: "Matplotlib", layer: "visualisation", use: "also", useIndex: 19 },
  { id: "seaborn", name: "Seaborn", layer: "visualisation", use: "also", useIndex: 20 },
  { id: "plotly", name: "Plotly", layer: "visualisation", use: "also", useIndex: 21 },
  { id: "tableau", name: "Tableau", layer: "visualisation", use: "also", useIndex: 22 },
  { id: "power-bi", name: "Power BI", layer: "visualisation", use: "also", useIndex: 23 },
];
