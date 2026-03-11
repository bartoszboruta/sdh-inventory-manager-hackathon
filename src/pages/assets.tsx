import Head from "next/head";

import { AssetsPage } from "~/features/assets/assets-page";

export default function AssetsRoute() {
	return (
		<>
			<Head>
				<title>Assets | SDH Inventory</title>
			</Head>
			<AssetsPage />
		</>
	);
}
