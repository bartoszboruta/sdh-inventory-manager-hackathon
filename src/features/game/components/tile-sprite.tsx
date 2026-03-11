import { cn } from "~/lib/utils";
import { TILESET_BY_ID } from "~/features/game/game-tiles";
import type { TilesetId } from "~/types/contracts";

type TileSpriteProps = {
	tileset: TilesetId;
	tileX: number;
	tileY: number;
	size?: number;
	className?: string;
};

export function TileSprite({ tileset, tileX, tileY, size = 16, className }: TileSpriteProps) {
	const config = TILESET_BY_ID[tileset];

	return (
		<div
			className={cn("shrink-0 bg-no-repeat", className)}
			style={{
				width: size,
				height: size,
				backgroundImage: `url(${config.src})`,
				backgroundPosition: `-${tileX * size}px -${tileY * size}px`,
				backgroundSize: `${config.defaultColumns * size}px auto`,
				imageRendering: "pixelated",
			}}
			aria-hidden
		/>
	);
}
