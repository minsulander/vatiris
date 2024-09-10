import express, { Request, Response } from "express";
import cors from "cors";

const app = express();
const port = process.env.PORT || 5172;

app.use(cors());

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

import axios from "axios";

app.get("/", async (req: Request, res: Response) => {
  res.send("Wassup");
});

const vatsimAuthBaseUri = "https://auth-dev.vatsim.net/";
const clientId = "682";
const clientSecret = "cXrGCBzSezuc0Ud12bGgWdX45H5EjJgMDCvscKib";
const redirectUri = "http://localhost:5173/login";

app.get("/token", async (req: Request, res: Response) => {
  try {
    const result = await axios.post(`${vatsimAuthBaseUri}oauth/token`, {
      grant_type: req.query.refresh_token
        ? "refresh_token"
        : "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: req.query.code,
      refresh_token: req.query.refresh_token,
    });
    res.send(result.data);
  } catch (error: any) {
    console.log("token error", error.response.data);
    res.status(error.response.status).json(error.response.data);
  }
});
