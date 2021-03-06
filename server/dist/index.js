"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const apollo_server_express_1 = require("apollo-server-express");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const ioredis_1 = __importDefault(require("ioredis"));
require("reflect-metadata");
const type_graphql_1 = require("type-graphql");
const consts_1 = require("./consts");
const hello_1 = require("./resolvers/hello");
const post_1 = require("./resolvers/post");
const user_1 = require("./resolvers/user");
const typeorm_1 = require("typeorm");
const Post_1 = require("./entities/Post");
const User_1 = require("./entities/User");
const path_1 = __importDefault(require("path"));
const Upvote_1 = require("./entities/Upvote");
const createUserLoader_1 = require("./utils/createUserLoader");
const createUpvoteLoader_1 = require("./utils/createUpvoteLoader");
const main = async () => {
    const conn = await typeorm_1.createConnection({
        type: "postgres",
        database: "lireddit",
        username: "postgres",
        password: "postgres",
        logging: true,
        synchronize: true,
        migrations: [path_1.default.join(__dirname, "./migrations/*")],
        entities: [Post_1.Post, User_1.User, Upvote_1.Upvote],
    });
    await conn.runMigrations();
    const expressServer = 4000;
    const app = express_1.default();
    const RedisStore = require("connect-redis")(express_session_1.default);
    const redis = new ioredis_1.default();
    app.use(cors_1.default({
        origin: "http://localhost:3000",
        credentials: true,
    }));
    app.use(express_session_1.default({
        name: consts_1.COOKIE_NAME,
        store: new RedisStore({
            client: redis,
            disableTouch: true,
        }),
        cookie: {
            maxAge: 1000 * 60 * 24 * 365 * 10,
            httpOnly: true,
            sameSite: "lax",
            secure: consts_1.__prod__,
        },
        saveUninitialized: false,
        secret: "redisSecret",
        resave: false,
    }));
    const apolloServer = new apollo_server_express_1.ApolloServer({
        schema: await type_graphql_1.buildSchema({
            resolvers: [hello_1.HelloResolver, post_1.PostResolver, user_1.UserResolver],
            validate: false,
        }),
        context: ({ req, res }) => ({
            req,
            res,
            redis,
            userLoader: createUserLoader_1.createUserLoader(),
            upvoteLoader: createUpvoteLoader_1.createUpvoteLoader(),
        }),
    });
    await apolloServer.start();
    apolloServer.applyMiddleware({
        app,
        cors: false,
    });
    app.listen(expressServer, () => {
        console.log("Server started on localhost:", expressServer);
    });
};
main().catch((err) => {
    console.error(err);
});
//# sourceMappingURL=index.js.map