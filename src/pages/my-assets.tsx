import Head from "next/head";

import { MyAssetsPage } from "~/features/my-assets/my-assets-page";

export default function MyAssetsRoute() {
	return (
		<>
			<Head>
				<title>My Assets | SDH Inventory</title>
			</Head>
			<MyAssetsPage />
		</>
	);
}
