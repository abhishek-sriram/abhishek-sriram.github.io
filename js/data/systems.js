/**
 * Engineering Workbench — system architectures.
 * Facts only from index.html. Do not invent latencies, model choices,
 * accuracy numbers, or design rationales beyond what is already published.
 */

export const systems = [
  {
    id: 'mindpulse',
    title: 'MindPulse',
    status: 'published',
    note: null,
    summary:
      'Full-stack AI platform screening young adults for depression and anxiety using PHQ-9 and GAD-7, extended with ML severity prediction, SHAP explainability, a custom Mental Health Index, real-time risk escalation and longitudinal tracking. LLaMA 3.3 70B via Groq generates personalized, symptom-specific guidance.',
    layers: ['flow'],
    links: [
      {
        label: 'Published paper',
        href: 'https://ieeexplore.ieee.org/document/11554646',
      },
      {
        label: 'Repository',
        href: 'https://github.com/abhishek-sriram/MindPulse-A-Multi-Modal-AI-System-For-Early-Detection-Of-Mental-Health-Crisis-In-Young-Adults',
      },
    ],
    nodes: [
      {
        id: 'questionnaire',
        label: 'PHQ-9 + GAD-7',
        kind: 'input',
        col: 0,
        row: 0,
        what: 'Questionnaire intake using PHQ-9 and GAD-7 to screen for depression and anxiety.',
        // TODO(abhishek): why this questionnaire pair was chosen over alternatives
        why: null,
        // TODO(abhishek): tradeoff of questionnaire length vs completion rate
        tradeoff: null,
        // TODO(abhishek): intake volume or completion metric
        metric: null,
        layers: ['flow'],
      },
      {
        id: 'severity',
        label: 'Severity model',
        kind: 'model',
        col: 1,
        row: 0,
        what: 'ML severity prediction layered on the questionnaire screening.',
        // TODO(abhishek): why this severity model family was chosen
        why: null,
        // TODO(abhishek): tradeoff of model complexity vs interpretability
        tradeoff: null,
        // TODO(abhishek): severity-prediction accuracy or calibration metric
        metric: null,
        layers: ['flow'],
      },
      {
        id: 'shap',
        label: 'SHAP',
        kind: 'service',
        col: 2,
        row: 0,
        what: 'SHAP explainability over the severity prediction.',
        // TODO(abhishek): why SHAP specifically (vs other attribution methods)
        why: null,
        // TODO(abhishek): tradeoff of explanation fidelity vs latency
        tradeoff: null,
        // TODO(abhishek): explanation latency or coverage metric
        metric: null,
        layers: ['flow'],
      },
      {
        id: 'mhi',
        label: 'Mental Health Index',
        kind: 'service',
        col: 3,
        row: 0,
        what: 'Custom Mental Health Index derived from the screening and severity path.',
        // TODO(abhishek): why a custom index instead of raw scores alone
        why: null,
        // TODO(abhishek): tradeoff in how the index is composed
        tradeoff: null,
        // TODO(abhishek): index distribution or validation metric
        metric: null,
        layers: ['flow'],
      },
      {
        id: 'escalation',
        label: 'Risk escalation',
        kind: 'monitor',
        col: 4,
        row: 0,
        what: 'Real-time risk escalation when screening signals warrant it.',
        // TODO(abhishek): why these escalation thresholds exist
        why: null,
        // TODO(abhishek): tradeoff of sensitivity vs false alarms
        tradeoff: null,
        // TODO(abhishek): escalation latency or precision metric
        metric: null,
        layers: ['flow'],
      },
      {
        id: 'longitudinal',
        label: 'Longitudinal store',
        kind: 'store',
        col: 2,
        row: 1,
        what: 'Longitudinal tracking store for screening history over time.',
        // TODO(abhishek): why longitudinal storage is required for the product
        why: null,
        // TODO(abhishek): tradeoff of retention window vs storage cost
        tradeoff: null,
        // TODO(abhishek): retention or query-latency metric
        metric: null,
        layers: ['flow'],
      },
      {
        id: 'llama',
        label: 'LLaMA 3.3 70B',
        kind: 'model',
        col: 4,
        row: 1,
        what: 'LLaMA 3.3 70B via Groq generating personalized, symptom-specific guidance instead of generic advice.',
        // TODO(abhishek): why LLaMA 3.3 70B via Groq for this guidance step
        why: null,
        // TODO(abhishek): tradeoff of model size vs response latency/cost
        tradeoff: null,
        // TODO(abhishek): guidance latency or quality metric
        metric: null,
        layers: ['flow'],
      },
      {
        id: 'guidance',
        label: 'Guidance',
        kind: 'output',
        col: 5,
        row: 1,
        what: 'Symptom-specific guidance returned to the user.',
        // TODO(abhishek): why this output shape for end users
        why: null,
        // TODO(abhishek): tradeoff of specificity vs clinical caution
        tradeoff: null,
        // TODO(abhishek): guidance usefulness or safety metric
        metric: null,
        layers: ['flow'],
      },
    ],
    edges: [
      { from: 'questionnaire', to: 'severity', layers: ['flow'] },
      { from: 'severity', to: 'shap', layers: ['flow'] },
      { from: 'shap', to: 'mhi', layers: ['flow'] },
      { from: 'mhi', to: 'escalation', layers: ['flow'] },
      { from: 'severity', to: 'longitudinal', label: 'history', layers: ['flow'] },
      { from: 'mhi', to: 'longitudinal', layers: ['flow'] },
      { from: 'escalation', to: 'llama', layers: ['flow'] },
      { from: 'longitudinal', to: 'llama', label: 'context', layers: ['flow'] },
      { from: 'llama', to: 'guidance', layers: ['flow'] },
    ],
  },

  {
    id: 'b4igo',
    title: 'B4iGo conversational agent',
    status: 'internal',
    note: 'Details generalised for confidentiality',
    summary:
      'Multimodal LLM-powered conversational chatbot on the B4iGo platform at Infobell IT. Users query their digital footprint and end-of-life preferences in natural language. RAG pipelines perform privacy-preserving retrieval across multiple sensitive data vaults.',
    layers: ['flow', 'privacy'],
    links: [],
    nodes: [
      {
        id: 'user-query',
        label: 'User query',
        kind: 'input',
        col: 0,
        row: 0,
        what: 'Natural-language query about the user’s digital footprint and end-of-life preferences.',
        // TODO(abhishek): why multimodal intake for this product surface
        why: null,
        // TODO(abhishek): tradeoff of modality coverage vs latency
        tradeoff: null,
        // TODO(abhishek): query volume or latency metric
        metric: null,
        layers: ['flow'],
      },
      {
        id: 'agent',
        label: 'Multimodal LLM',
        kind: 'model',
        col: 1,
        row: 0,
        what: 'Multimodal LLM-powered conversational agent that answers in natural language.',
        // TODO(abhishek): why this multimodal LLM stack was selected
        why: null,
        // TODO(abhishek): tradeoff of multimodal capability vs cost
        tradeoff: null,
        // TODO(abhishek): agent latency or satisfaction metric
        metric: null,
        layers: ['flow'],
      },
      {
        id: 'rag',
        label: 'RAG pipeline',
        kind: 'service',
        col: 2,
        row: 0,
        what: 'RAG pipelines for precise, privacy-preserving retrieval across sensitive vaults.',
        // TODO(abhishek): why RAG over fine-tuning for vault-backed answers
        why: null,
        // TODO(abhishek): tradeoff of retrieval precision vs recall
        tradeoff: null,
        // TODO(abhishek): retrieval precision or latency metric
        metric: null,
        layers: ['flow', 'privacy'],
      },
      {
        id: 'vaults',
        label: 'Data vaults',
        kind: 'store',
        col: 3,
        row: 0,
        what: 'Multiple sensitive data vaults queried through privacy-preserving retrieval.',
        // TODO(abhishek): why vault separation was required
        why: null,
        // TODO(abhishek): tradeoff of vault isolation vs retrieval complexity
        tradeoff: null,
        // TODO(abhishek): vault access or isolation metric
        metric: null,
        layers: ['flow', 'privacy'],
      },
      {
        id: 'answer',
        label: 'NL answer',
        kind: 'output',
        col: 2,
        row: 1,
        what: 'Natural-language answer grounded in retrieved vault context.',
        // TODO(abhishek): why this answer format for B4iGo users
        why: null,
        // TODO(abhishek): tradeoff of verbosity vs privacy leakage risk
        tradeoff: null,
        // TODO(abhishek): answer grounding or safety metric
        metric: null,
        layers: ['flow'],
      },
    ],
    edges: [
      { from: 'user-query', to: 'agent', layers: ['flow'] },
      { from: 'agent', to: 'rag', layers: ['flow'] },
      { from: 'rag', to: 'vaults', layers: ['flow', 'privacy'] },
      { from: 'vaults', to: 'rag', label: 'context', layers: ['flow', 'privacy'] },
      { from: 'rag', to: 'answer', layers: ['flow'] },
      { from: 'agent', to: 'answer', layers: ['flow'] },
    ],
  },

  {
    id: 'legislative-ebook',
    title: 'Legislative eBook search',
    status: 'internal',
    note: 'Details generalised for confidentiality',
    summary:
      'Contextual semantic search system for an AI-powered legislative assembly eBook at CODEWORK, built with Gemini 2.0 Flash.',
    layers: ['flow', 'metrics'],
    links: [],
    nodes: [
      {
        id: 'search-query',
        label: 'Search query',
        kind: 'input',
        col: 0,
        row: 0,
        what: 'User query against the legislative assembly eBook corpus.',
        // TODO(abhishek): why free-text semantic search for this corpus
        why: null,
        // TODO(abhishek): tradeoff of semantic vs keyword search
        tradeoff: null,
        // TODO(abhishek): query volume metric
        metric: null,
        layers: ['flow'],
      },
      {
        id: 'semantic',
        label: 'Semantic search',
        kind: 'service',
        col: 1,
        row: 0,
        what: 'Contextual semantic search over the legislative eBook.',
        // TODO(abhishek): why this retrieval approach for legislation
        why: null,
        // TODO(abhishek): tradeoff of context window vs ranking quality
        tradeoff: null,
        // TODO(abhishek): retrieval-only accuracy metric if measured separately
        metric: null,
        layers: ['flow'],
      },
      {
        id: 'gemini',
        label: 'Gemini 2.0 Flash',
        kind: 'model',
        col: 2,
        row: 0,
        what: 'Gemini 2.0 Flash powering the contextual semantic search system.',
        // TODO(abhishek): why Gemini 2.0 Flash for this workload
        why: null,
        // TODO(abhishek): tradeoff of Flash latency/cost vs larger Gemini variants
        tradeoff: null,
        metric: '94% accuracy',
        layers: ['flow', 'metrics'],
      },
      {
        id: 'results',
        label: 'Search results',
        kind: 'output',
        col: 3,
        row: 0,
        what: 'Contextual search results returned from the legislative eBook system.',
        // TODO(abhishek): why this result presentation for assembly users
        why: null,
        // TODO(abhishek): tradeoff of result count vs relevance
        tradeoff: null,
        // TODO(abhishek): end-to-end result quality metric beyond the stated 94%
        metric: null,
        layers: ['flow'],
      },
    ],
    edges: [
      { from: 'search-query', to: 'semantic', layers: ['flow'] },
      { from: 'semantic', to: 'gemini', layers: ['flow'] },
      { from: 'gemini', to: 'results', layers: ['flow'] },
    ],
  },
];
