/**
 * Toolkit — tools grouped by the AI-system layer they serve.
 * Names and used-in notes only from index.html. No proficiency claims.
 */

export const toolkitLayers = [
  {
    id: 'data',
    name: 'Data',
    tools: [
      {
        name: 'MySQL',
        usedIn: [
          { label: 'Stress Detection', href: '#projects' },
          { label: 'Infosys Springboard', href: '#experience' },
        ],
      },
      { name: 'PostgreSQL' },
      { name: 'MongoDB' },
      { name: 'Apache Hadoop' },
      { name: 'Hive' },
      { name: 'Sqoop' },
      { name: 'Spark' },
      { name: 'Kafka' },
    ],
  },
  {
    id: 'models',
    name: 'Models',
    tools: [
      { name: 'PyTorch' },
      { name: 'TensorFlow' },
      { name: 'Keras' },
      {
        name: 'Scikit-learn',
        usedIn: [{ label: 'PCA + K-Means · Feynn Labs', href: '#experience' }],
      },
    ],
  },
  {
    id: 'retrieval',
    name: 'Retrieval',
    tools: [
      {
        name: 'RAG',
        usedIn: [
          { label: 'B4iGo', href: '#systems/b4igo' },
          { label: 'RAG-based QA Chatbot', href: '#projects' },
        ],
      },
      { name: 'Pinecone' },
      { name: 'ChromaDB' },
    ],
  },
  {
    id: 'orchestration',
    name: 'Orchestration',
    tools: [
      { name: 'LangChain' },
      { name: 'LangGraph' },
      { name: 'MCP' },
    ],
  },
  {
    id: 'serving',
    name: 'Serving',
    tools: [
      { name: 'Python' },
      { name: 'FastAPI' },
      {
        name: 'Django',
        usedIn: [
          { label: 'Stress Detection', href: '#projects' },
          { label: 'Infosys Springboard', href: '#experience' },
        ],
      },
      { name: 'Docker' },
      { name: 'Kubernetes' },
      { name: 'Jenkins' },
    ],
  },
  {
    id: 'observability',
    name: 'Observability',
    tools: [
      { name: 'Prometheus' },
      { name: 'Grafana' },
    ],
  },
  {
    id: 'visualisation',
    name: 'Visualisation',
    tools: [
      { name: 'Matplotlib' },
      { name: 'Seaborn' },
      { name: 'Plotly' },
      { name: 'Tableau' },
      { name: 'Power BI' },
    ],
  },
];
