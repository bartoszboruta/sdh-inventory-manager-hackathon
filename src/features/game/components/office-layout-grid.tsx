import { getCellKey } from "~/features/game/game-tiles";
import { cn } from "~/lib/utils";
import type { OfficeLayout } from "~/types/contracts";

import { TileSprite } from "./tile-sprite";

type OfficeLayoutGridProps = {
  layout: OfficeLayout;
  onCellClick?: (x: number, y: number, metaKey: boolean) => void;
  onCellPointerDown?: (x: number, y: number, metaKey: boolean) => void;
  onCellPointerEnter?: (x: number, y: number) => void;
  onCellPointerUp?: (metaKey: boolean) => void;
  interactive?: boolean;
  cellSize?: number;
  previewKeys?: Set<string>;
  playerPosition?: { x: number; y: number };
};

export function OfficeLayoutGrid({
  layout,
  onCellClick,
  onCellPointerDown,
  onCellPointerEnter,
  onCellPointerUp,
  interactive = false,
  cellSize = 24,
  previewKeys,
  playerPosition,
}: OfficeLayoutGridProps) {
  const cells = Array.from(
    { length: layout.width * layout.height },
    (_, index) => {
      const x = index % layout.width;
      const y = Math.floor(index / layout.width);
      const key = getCellKey(x, y);
      const baseTile = layout.baseLayer[key];
      const assetTile = layout.assetLayer[key];

      return (
        <button
          key={key}
          type="button"
          onClick={
            onCellClick
              ? (event) => onCellClick(x, y, event.metaKey)
              : undefined
          }
          onPointerDown={
            onCellPointerDown
              ? (event) => onCellPointerDown(x, y, event.metaKey)
              : undefined
          }
          onPointerEnter={
            onCellPointerEnter ? () => onCellPointerEnter(x, y) : undefined
          }
          onPointerUp={
            onCellPointerUp
              ? (event) => onCellPointerUp(event.metaKey)
              : undefined
          }
          disabled={!interactive}
          className={cn(
            "relative border border-black/20 bg-black/5",
            interactive
              ? "cursor-crosshair hover:bg-black/10"
              : "cursor-default",
          )}
          style={{
            width: cellSize,
            height: cellSize,
          }}
          aria-label={`Tile ${x + 1}, ${y + 1}`}
        >
          {baseTile ? (
            <TileSprite
              tileset={baseTile.tileset}
              tileX={baseTile.tileX}
              tileY={baseTile.tileY}
              size={cellSize}
              className="absolute inset-0"
            />
          ) : null}
          {assetTile ? (
            <TileSprite
              tileset={assetTile.tileset}
              tileX={assetTile.tileX}
              tileY={assetTile.tileY}
              size={cellSize}
              className="absolute inset-0"
            />
          ) : null}
          {previewKeys?.has(key) ? (
            <div className="pointer-events-none absolute inset-0 border border-primary/80 bg-primary/20" />
          ) : null}
          {playerPosition?.x === x && playerPosition?.y === y ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <img
                src="/tilesets/Blank16x16CharacterTemplate.gif"
                alt=""
                className="pixelated"
                style={{
                  width: Math.round(cellSize * 2.5),
                  height: Math.round(cellSize * 2.5),
                  imageRendering: "pixelated",
                }}
                aria-hidden
              />
            </div>
          ) : null}
        </button>
      );
    },
  );

  return (
    <div
      className="grid border border-black/30 bg-white shadow-inner"
      style={{
        gridTemplateColumns: `repeat(${layout.width}, minmax(0, 1fr))`,
        width: layout.width * cellSize,
      }}
    >
      {cells}
    </div>
  );
}
