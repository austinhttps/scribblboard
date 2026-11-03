export type ToolType =
  | 'select'
  | 'pan'
  | 'pen'
  | 'rect'
  | 'circle'
  | 'arrow'
  | 'line'
  | 'sticky'
  | 'text'
  | 'eraser'
  | 'frame'
  | 'laser';

export type StickyColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange';
export type ThemeMode = 'dark' | 'light';

export type ConnectionAnchor = 'top' | 'right' | 'bottom' | 'left';

export interface ElementBinding {
  elementId: string;
  anchor: ConnectionAnchor;
}

export interface ReactionItem {
  id: string;
  emoji: string;
  userId: string;
  userName: string;
  createdAt: number;
}

export interface CommentReply {
  id: string;
  author: string;
  authorColor: string;
  text: string;
  createdAt: number;
}

export interface CommentThread {
  id: string;
  elementId: string;
  author: string;
  authorColor: string;
  text: string;
  createdAt: number;
  replies: CommentReply[];
  resolved?: boolean;
}

export interface BaseElement {
  id: string;
  type: string;
  x: number;
  y: number;
  rotation?: number;
  zIndex: number;
  updatedAt: number;
  reactions?: ReactionItem[];
  locked?: boolean;
  groupId?: string;
  frameId?: string;
}

export interface PenElement extends BaseElement {
  type: 'pen';
  points: number[];
  color: string;
  strokeWidth: number;
}

export interface RectElement extends BaseElement {
  type: 'rect';
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius?: number;
}

export interface CircleElement extends BaseElement {
  type: 'circle';
  radiusX: number;
  radiusY: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface ArrowElement extends BaseElement {
  type: 'arrow';
  points: number[];
  color: string;
  strokeWidth: number;
  pointerLength?: number;
  pointerWidth?: number;
  startBinding?: ElementBinding;
  endBinding?: ElementBinding;
}

export interface LineElement extends BaseElement {
  type: 'line';
  points: number[];
  color: string;
  strokeWidth: number;
  startBinding?: ElementBinding;
  endBinding?: ElementBinding;
}

export interface StickyElement extends BaseElement {
  type: 'sticky';
  width: number;
  height: number;
  text: string;
  color: StickyColor;
  fontSize: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  width?: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  width: number;
  height: number;
}

export interface FrameElement extends BaseElement {
  type: 'frame';
  title: string;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export type AlignmentType = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributionType = 'horizontal' | 'vertical';

export interface LaserPoint {
  x: number;
  y: number;
  color: string;
  timestamp: number;
}

export type CanvasElement =
  | PenElement
  | RectElement
  | CircleElement
  | ArrowElement
  | LineElement
  | StickyElement
  | TextElement
  | ImageElement
  | FrameElement;

export interface ToolProperties {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  fontSize: number;
  stickyColor: StickyColor;
}

export type GridType = 'dots' | 'grid' | 'none';

export interface Collaborator {
  clientId: number;
  name: string;
  color: string;
  cursor?: {
    x: number;
    y: number;
  };
  viewport?: {
    x: number;
    y: number;
    scale: number;
  };
  laserTrail?: {
    points: number[];
    color: string;
    timestamp: number;
  };
}

export interface ConnectorPoint {
  x: number;
  y: number;
  anchor: ConnectionAnchor;
  elementId: string;
}
