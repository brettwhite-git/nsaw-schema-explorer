// Figure registry: import this once (site/main.tsx) so every figure is known by key.
import { registerFigure } from './contract';

registerFigure('sewn-star', () => import('./sewn-star'));
registerFigure('section', () => import('./section'));
registerFigure('order-line-journey', () => import('./order-line-journey'));

export * from './contract';
