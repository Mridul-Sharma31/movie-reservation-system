import express from "express"
import cookieParser from "cookie-parser"
//global error middleware import


const app = express();

//* middleware
app.use(express.json({limit:"32"}));
app.use(cookieParser());
// url encoded download and use here

//* routers


export {app}