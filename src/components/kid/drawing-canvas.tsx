"use client";

import { useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };
type Stroke = { color: string; size: number; points: Point[] };

const WIDTH = 1200;
const HEIGHT = 900; // 4:3, 삽화와 같은 비율
const BACKGROUND = "#ffffff";
const COLORS = ["#1f2937", "#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#92400e"];
const SIZES = [{ label: "가늘게", value: 10 }, { label: "굵게", value: 28 }];
const ERASER_SIZE = 48;

type Props = {
  onDone: (dataUrl: string) => void;
  onCancel: () => void;
};

// 그림 그리기 (INP-01): 손가락으로 그리기, 색, 굵기, 지우개, 되돌리기, 전체 지우기
export default function DrawingCanvas({ onDone, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Stroke | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1].value);
  const [erasing, setErasing] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);

  useEffect(() => redraw(canvasRef.current, strokesRef.current), []);

  function toCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
    };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    // 손바닥이 닿아 생기는 두 번째 터치는 무시
    if (!e.isPrimary || currentRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const stroke = erasing
      ? { color: BACKGROUND, size: ERASER_SIZE, points: [toCanvasPoint(e)] }
      : { color, size, points: [toCanvasPoint(e)] };
    currentRef.current = stroke;
    drawDot(canvasRef.current?.getContext("2d"), stroke);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = currentRef.current;
    if (!stroke || !e.isPrimary) return;
    stroke.points.push(toCanvasPoint(e));
    drawTail(canvasRef.current?.getContext("2d"), stroke);
  }

  function up(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!e.isPrimary || !currentRef.current) return;
    drawEnd(canvasRef.current?.getContext("2d"), currentRef.current);
    strokesRef.current.push(currentRef.current);
    currentRef.current = null;
    setStrokeCount(strokesRef.current.length);
  }

  function undo() {
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    redraw(canvasRef.current, strokesRef.current);
  }

  function clear() {
    strokesRef.current = [];
    setStrokeCount(0);
    redraw(canvasRef.current, []);
  }

  function done() {
    const canvas = canvasRef.current;
    if (canvas) onDone(canvas.toDataURL("image/png"));
  }

  const empty = strokeCount === 0;

  return (
    <div className="flex flex-1 flex-col gap-3 lg:flex-row">
      {/* 캔버스는 고유 비율(4:3)을 유지한 채 남는 공간에 맞춰 줄어든다. 늘려서 채우면 그림이 찌그러진다 */}
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          aria-label="그림판"
          className="h-auto max-h-[calc(100dvh-12rem)] w-auto max-w-full touch-none rounded-3xl bg-white shadow-md lg:max-h-[calc(100dvh-3rem)]"
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 lg:w-64 lg:flex-col lg:flex-nowrap">
        <div className="grid grid-cols-9 gap-2 lg:grid-cols-3" role="radiogroup" aria-label="색">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={!erasing && color === c}
              aria-label={`색 ${c}`}
              onClick={() => {
                setColor(c);
                setErasing(false);
              }}
              className={`size-12 rounded-full border-4 shadow-sm ${!erasing && color === c ? "scale-110 border-zinc-800" : "border-white"}`}
              style={{ background: c }}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {SIZES.map((s) => (
            <ToolButton key={s.value} active={!erasing && size === s.value} onClick={() => { setSize(s.value); setErasing(false); }}>
              <span className="inline-block rounded-full bg-zinc-800" style={{ width: s.value / 1.5, height: s.value / 1.5 }} />
              {s.label}
            </ToolButton>
          ))}
        </div>

        <div className="flex gap-2">
          <ToolButton active={erasing} onClick={() => setErasing(true)}>🧽 지우개</ToolButton>
          <ToolButton disabled={empty} onClick={undo}>↩️ 되돌리기</ToolButton>
        </div>
        <ToolButton disabled={empty} onClick={clear}>🗑️ 다 지우기</ToolButton>

        <div className="flex gap-2 lg:mt-auto lg:flex-col lg:self-stretch">
          <button type="button" onClick={onCancel} className="rounded-full bg-white px-5 py-4 text-xl font-bold shadow-sm active:scale-95">
            그만하기
          </button>
          <button
            type="button"
            disabled={empty}
            onClick={done}
            className="rounded-full bg-emerald-500 px-6 py-4 text-2xl font-bold text-white shadow-md active:scale-95 disabled:bg-zinc-300"
          >
            ✅ 다 그렸어
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolButton({ active, disabled, onClick, children }: { active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-3 text-lg font-bold shadow-sm active:scale-95 disabled:opacity-40 ${active ? "bg-amber-300" : "bg-white"}`}
    >
      {children}
    </button>
  );
}

function prepare(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function drawDot(ctx: CanvasRenderingContext2D | null | undefined, stroke: Stroke) {
  if (!ctx) return;
  const p = stroke.points[0];
  prepare(ctx, stroke);
  ctx.beginPath();
  ctx.arc(p.x, p.y, stroke.size / 2, 0, Math.PI * 2);
  ctx.fill();
}

// 마지막 구간만 이어 그린다 (매 이동마다 전체를 다시 그리지 않음)
function drawTail(ctx: CanvasRenderingContext2D | null | undefined, stroke: Stroke) {
  if (!ctx) return;
  const pts = stroke.points;
  const n = pts.length;
  if (n < 2) return;
  prepare(ctx, stroke);
  ctx.beginPath();
  if (n === 2) {
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
  } else {
    // 중점을 잇는 2차 곡선으로 부드럽게
    const a = pts[n - 3], b = pts[n - 2], c = pts[n - 1];
    ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
    ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
  }
  ctx.stroke();
}

// 곡선은 마지막 중점까지만 그려지므로, 손을 떼면 끝점까지 마저 잇는다
function drawEnd(ctx: CanvasRenderingContext2D | null | undefined, stroke: Stroke) {
  const pts = stroke.points;
  if (!ctx || pts.length < 3) return;
  const b = pts[pts.length - 2], c = pts[pts.length - 1];
  prepare(ctx, stroke);
  ctx.beginPath();
  ctx.moveTo((b.x + c.x) / 2, (b.y + c.y) / 2);
  ctx.lineTo(c.x, c.y);
  ctx.stroke();
}

function redraw(canvas: HTMLCanvasElement | null, strokes: Stroke[]) {
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (const stroke of strokes) {
    drawDot(ctx, stroke);
    const pts = stroke.points;
    if (pts.length < 2) continue;
    prepare(ctx, stroke);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
}
