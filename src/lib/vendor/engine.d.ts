// Narrow integration boundary for the bundled third-party engine.
export const Engine: new (options: unknown) => import('../port.ts').EnginePort;
