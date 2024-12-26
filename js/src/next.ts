import type { NextApiRequest, NextApiResponse } from "next";
import type { RailwayImagesClient } from "./server";

export function createHandler(client: RailwayImagesClient) {
	return {
		async handler(req: NextApiRequest, res: NextApiResponse<unknown>) {
			switch (req.method) {
				case "GET":
					break;
				case "PUT":
					break;
				case "DELETE":
					break;
			}

			res.redirect(301, "");
		},
	};
}
