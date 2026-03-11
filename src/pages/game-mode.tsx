import Head from "next/head";

import { EmployeeGameModePage } from "~/features/game/employee-game-mode-page";

export default function GameModeRoute() {
	return (
		<>
			<Head>
				<title>Game Mode | SDH Inventory</title>
			</Head>
			<EmployeeGameModePage />
		</>
	);
}
