import { Check, Minus, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const OUTPUT_SIZE = 512;

type ImageSize = { width: number; height: number };
type Position = { x: number; y: number };

interface AvatarImageEditorProps {
  file: File;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function AvatarImageEditor({ file, onCancel, onConfirm }: AvatarImageEditorProps) {
  const [source, setSource] = useState('');
  const [size, setSize] = useState<ImageSize>({ width: 1, height: 1 });
  const [zoom, setZoom] = useState(1);
  const [viewportSize, setViewportSize] = useState(280);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerX: number; pointerY: number; start: Position } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => setViewportSize(viewport.clientWidth));
    observer.observe(viewport);
    setViewportSize(viewport.clientWidth);
    return () => observer.disconnect();
  }, []);

  const baseScale = useMemo(
    () => Math.max(viewportSize / size.width, viewportSize / size.height),
    [size, viewportSize],
  );
  const scale = baseScale * zoom;
  const maxX = Math.max(0, (size.width * scale - viewportSize) / 2);
  const maxY = Math.max(0, (size.height * scale - viewportSize) / 2);
  const constrainedPosition = {
    x: clamp(position.x, -maxX, maxX),
    y: clamp(position.y, -maxY, maxY),
  };

  const changeZoom = (nextZoom: number) => {
    setZoom(clamp(nextZoom, 1, 3));
    setPosition((current) => current);
  };

  const confirm = () => {
    const image = imageRef.current;
    // Without a decoded image the canvas would silently produce a solid black
    // square, which uploads and stores just fine — refuse instead.
    if (!image?.naturalWidth || !image.naturalHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext('2d');
    if (!context) return;
    const outputScale = scale * (OUTPUT_SIZE / viewportSize);
    context.drawImage(
      image,
      OUTPUT_SIZE / 2 -
        (size.width * outputScale) / 2 +
        constrainedPosition.x * (OUTPUT_SIZE / viewportSize),
      OUTPUT_SIZE / 2 -
        (size.height * outputScale) / 2 +
        constrainedPosition.y * (OUTPUT_SIZE / viewportSize),
      size.width * outputScale,
      size.height * outputScale,
    );
    onConfirm(canvas.toDataURL('image/jpeg', 0.9));
  };

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/[0.82] p-4 backdrop-blur-[8px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-editor-title"
    >
      <section className="w-[min(100%,28rem)] rounded-[0.85rem] border border-[rgba(214,170,91,0.22)] bg-panel p-[1.2rem] text-[#f0ede6] shadow-[0_1.5rem_5rem_rgba(0,0,0,0.55)]">
        <header className="flex items-center justify-between">
          <div>
            <span className="text-[0.62rem] tracking-[0.12em] text-gold uppercase">
              Fotografia de perfil
            </span>
            <h2 id="avatar-editor-title" className="mt-[0.2rem] font-[Georgia,serif] text-[1.35rem]">
              Ajustar enquadramento
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fechar editor"
            className="grid cursor-pointer border-0 bg-transparent p-[0.35rem] text-[#aaa]"
          >
            <X />
          </button>
        </header>
        <p className="my-[0.7rem] mt-[0.7rem] mb-4 text-[0.72rem] leading-[1.5] text-[#898c84]">
          Arrasta a imagem e utiliza o controlo de zoom para escolher o enquadramento.
        </p>
        <div
          ref={viewportRef}
          className="relative mx-auto w-[min(280px,100%)] max-w-full touch-none rounded-xl bg-[#080907] [aspect-ratio:1] cursor-grab overflow-hidden select-none active:cursor-grabbing"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = {
              pointerX: event.clientX,
              pointerY: event.clientY,
              start: constrainedPosition,
            };
          }}
          onPointerMove={(event) => {
            if (!dragRef.current) return;
            setPosition({
              x: clamp(
                dragRef.current.start.x + event.clientX - dragRef.current.pointerX,
                -maxX,
                maxX,
              ),
              y: clamp(
                dragRef.current.start.y + event.clientY - dragRef.current.pointerY,
                -maxY,
                maxY,
              ),
            });
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          {source && (
            <img
              ref={imageRef}
              src={source}
              alt="Pré-visualização da fotografia"
              draggable={false}
              onLoad={(event) => {
                setSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
                setPosition({ x: 0, y: 0 });
              }}
              className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
              style={{
                width: size.width * scale,
                height: size.height * scale,
                transform: `translate(calc(-50% + ${constrainedPosition.x}px), calc(-50% + ${constrainedPosition.y}px))`,
              }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_80px_rgba(0,0,0,0.58)]" />
        </div>
        <div className="mx-auto my-4 flex w-[280px] max-w-full items-center gap-[0.65rem] text-[#b48a47]">
          <Minus size={16} />
          <input
            aria-label="Zoom da fotografia"
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => changeZoom(Number(event.target.value))}
            className="w-full accent-gold"
          />
          <Plus size={16} />
        </div>
        <footer className="flex justify-end gap-[0.65rem] max-[360px]:flex-col-reverse">
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              'flex min-h-[2.7rem] cursor-pointer items-center justify-center gap-[0.4rem] rounded-[0.45rem] px-[0.9rem] text-[0.72rem] font-bold',
              'border border-white/10 bg-transparent text-[#b5b5af]',
              'max-[360px]:w-full',
            )}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirm}
            className={cn(
              'flex min-h-[2.7rem] cursor-pointer items-center justify-center gap-[0.4rem] rounded-[0.45rem] px-[0.9rem] text-[0.72rem] font-bold',
              'border border-gold-accent bg-[linear-gradient(135deg,#e0b96f,#a87934)] text-[#17130d]',
              'max-[360px]:w-full',
            )}
          >
            <Check /> Utilizar fotografia
          </button>
        </footer>
      </section>
    </div>
  );
}
