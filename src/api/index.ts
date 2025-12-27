import dotenv from "dotenv";
import { createServer } from "./server";

dotenv.config();

const PORT = process.env.PORT || 8000;

const app = createServer();

app.listen(PORT, () => {
    console.log(`DevFleet Server is Up and running on port ${PORT}`);
});
