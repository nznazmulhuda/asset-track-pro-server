const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

// data
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
    cors({
        origin: ["http://localhost:3000"],
        credentials: true,
    }),
);
app.use(express.json());

// server configuration
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.pbmq8lu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});
async function run() {
    try {
        await client.connect(); // connect

        const UserDB = client.db("AssetTrackPro").collection("users");

        // User Services
        app.get("/user", async (req, res) => {
            const result = await UserDB.find({}).toArray();
            res.send(result);
        });

        app.post("/user", async (req, res) => {
            const user = req.body;
            const result = await UserDB.insertOne(user);
            res.send(result);
            // console.log(req.body);
        });

        // user role service
        app.get("/role", async (req, res) => {
            const email = req.query.email;
            const result = await UserDB.findOne({ email: email });
            res.send(result);
        });

        await client.db("admin").command({ ping: 1 });
        console.log(
            "Pinged your deployment. You successfully connected to MongoDB!",
        );
    } finally {
    }
}
run().catch(console.dir);

// test server connection
app.get("/", (req, res) => {
    res.send("Server is running...");
});

// Listening
app.listen(port, () => {
    console.log(`listening at ${port}`);
});
