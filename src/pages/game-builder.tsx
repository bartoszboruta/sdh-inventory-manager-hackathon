import Head from "next/head";

import { ManagerGameBuilderPage } from "~/features/game/manager-game-builder-page";

export default function GameBuilderRoute() {
	return (
		<>
			<Head>
				<title>Game Builder | SDH Inventory</title>
			</Head>
			<ManagerGameBuilderPage />
		</>
	);
}
