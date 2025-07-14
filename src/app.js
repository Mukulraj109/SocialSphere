import express from "express" 
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()


const allowedOrigins = [
  'http://localhost:5173',
  'https://gleaming-jalebi-5e3c20.netlify.app', 
];


app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));


app.use(express.json({limit:"100mb"}));
app.use(express.urlencoded({extended:true, limit:"100mb"}));

app.use(express.static("public"))
app.use(cookieParser())

import userRouter from "./routes/user.routes.js"
import videoRouter from "./routes/video.routes.js"
import playlistRouter from "./routes/playlist.routes.js"
import subscriptionRouter from "./routes/subscription.routes.js"
import communityRouter from "./routes/community.routes.js"
import commentRouter from "./routes/comment.routes.js"
import likeRouter from "./routes/like.routes.js"

app.use("/api/v1/users",userRouter);
app.use("/api/v1/videos",videoRouter);
app.use("/api/v1/playlists",playlistRouter);
app.use("/api/v1/subscriptions",subscriptionRouter);
app.use("/api/v1/communities",communityRouter);
app.use("/api/v1/comments",commentRouter);
app.use("/api/v1/likes",likeRouter);

export default app;

