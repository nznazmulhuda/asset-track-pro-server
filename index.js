const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");

// data
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
    cors({
        origin: ["http://localhost:3000", "https://asset-track-pro.web.app"],
        credentials: true,
    }),
);
app.use(express.json());

// custom middleware
const verifyToken = async (req, res, next) => {
    const token = req.body.token;
    if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
    }

    jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "unauthorized access" });
        }
        req.user = decoded;
        next();
    });
};

// server configuration
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.pbmq8lu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: false,
        deprecationErrors: true,
    },
});
async function run() {
    try {
        // all database and collection
        const UserDB = client.db("AssetTrackPro").collection("users");
        const AssetDB = client.db("AssetTrackPro").collection("assets");
        const RequestDB = client.db("AssetTrackPro").collection("requests");
        /**************************** JWT Servicess ******************/
        app.post("/token", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.SECRET_KEY, {
                expiresIn: "1h",
            });
        });

        /**************************** User Services ******************/
        app.get("/user", async (req, res) => {
            const email = req.query.email;
            if (!email) {
                const result = await UserDB.find({}).toArray();
                return res.send(result);
            }

            const result = await UserDB.findOne({ email: email });
            res.send(result);
        });

        app.post("/user", async (req, res) => {
            const user = req.body;
            const result = await UserDB.insertOne(user);
            res.send(result);
        });

        app.put("/user", async (req, res) => {
            const user = req.body;
            const modify = req.query.modify;
            if (!Boolean(modify)) {
                const result = await UserDB.updateOne(
                    {
                        email: "akhirulislam@gmail.com",
                    },
                    {
                        $addToSet: { employee: { $each: [user] } },
                    },
                );
                return res.send(result);
            }

            const result = await UserDB.updateOne(
                {
                    email: "akhirulislam@gmail.com",
                },
                {
                    $pull: { employee: user },
                },
            );
            return res.send(result);
        });

        // user role service
        app.get("/role", async (req, res) => {
            const email = req?.query?.email;
            const result = await UserDB.findOne({ email: email });
            res.send(result);
        });

        /************************ User Services done ******************/

        /************************ Asset Services **********************/
        app.get("/asset", async (req, res) => {
            const search = req.query.search;
            const sort = req.query.sort;
            const status = req.query.status;
            const type = req.query.type;
            let result;

            if (search === "null" || !search) {
                if (sort === "null" && type === "null" && status === "null") {
                    // if no sort, type, status is specified
                    result = await AssetDB.find().toArray();
                }

                // if only type is specified
                else if (
                    type !== "null" &&
                    sort === "null" &&
                    status === "null"
                ) {
                    result = await AssetDB.find({
                        productType:
                            type === "returnable"
                                ? "returnable"
                                : "non-returnable",
                    }).toArray();
                    return res.send(result);
                }

                // if only sort is specified
                else if (
                    type === "null" &&
                    sort !== "null" &&
                    status === "null"
                ) {
                    result = await AssetDB.find()
                        .sort({
                            productQuantity: sort === "highToLow" ? -1 : +1,
                        })
                        .toArray();
                    return res.send(result);
                }

                // if only status is specified
                else if (
                    type !== "null" ||
                    sort !== "null" ||
                    status !== "null"
                ) {
                    result = await AssetDB.find({
                        $or: [
                            { productType: type ? type : 0 },
                            {
                                productQuantity:
                                    status === "available"
                                        ? { $ne: 0 }
                                        : { $eq: 0 },
                            },
                        ],
                    })
                        .sort({
                            productQuantity: sort
                                ? sort === "highToLow"
                                    ? -1
                                    : +1
                                : 0,
                        })
                        .toArray();

                    return res.send(result);
                }

                // if sort is specified also type is specified and status is not specified
                else if (sort === "highToLow" && status === "null") {
                    result = await AssetDB.find()
                        .sort({ productQuantity: -1 })
                        .toArray();

                    if (type) {
                        result = await AssetDB.find({
                            productType: type,
                        })
                            .sort({ productQuantity: -1 })
                            .toArray();
                    }
                }

                // if sort is specified also type is specified and status is not specified
                else if (sort === "lowToHigh" && status === "null") {
                    result = await AssetDB.find()
                        .sort({ productQuantity: +1 })
                        .toArray();

                    if (type !== "null") {
                        result = await AssetDB.find({
                            productType: type,
                        }).toArray();
                    }
                }
            }

            // if search is specified
            else {
                const agg = [
                    {
                        $search: {
                            index: "search",
                            text: {
                                query: search,
                                path: {
                                    wildcard: "*",
                                },
                                fuzzy: {},
                            },
                        },
                    },
                ];

                const cursor = AssetDB.aggregate(agg);
                let searchResult = await cursor.toArray();

                if (type !== "null") {
                    result = searchResult.filter(
                        (item) => item.productType === type,
                    );
                    res.send(result);
                    return;
                } else if (status !== "null") {
                    result = searchResult.filter((item) =>
                        status === "available"
                            ? item.productQuantity >= 0
                            : item.productQuantity === 0,
                    );
                    res.send(result);
                    return;
                } else if (sort !== "null") {
                    searchResult.sort((a, b) => {
                        if (sort === "highToLow") {
                            return b.productQuantity - a.productQuantity;
                        } else {
                            return a.productQuantity - b.productQuantity;
                        }
                    });
                    res.send(searchResult);
                    return;
                }
                res.send(searchResult);
                return;
            }

            return res.send(result);
        });

        app.post("/asset", async (req, res) => {
            const asset = req.body;
            const result = await AssetDB.insertOne(asset);
            res.send(result);
        });

        app.get("/request", async (req, res) => {
            const email = req.query.email;
            const search = req.query.search;
            const status = req.query.status;
            const type = req.query.type;
            const clientMail = req.query.clientMail;

            if (email) {
                const allResult = await RequestDB.find().toArray();
                const result = allResult.filter(
                    (item) => item.rowData.companyEmail === email,
                );
                res.send(result);
                return;
            }

            if (search === "null" || !search) {
                if (type === "null" && status === "null") {
                    // if no type, status is specified
                    const allResult = await RequestDB.find().toArray();
                    const result = allResult.filter(
                        (item) => item.email === clientMail,
                    );
                    return res.send(result);
                }

                // if only type is specified
                else if (type !== "null" && status === "null") {
                    const allData = await RequestDB.find().toArray();
                    const allResult = allData.filter(
                        (item) => item.email === email,
                    );
                    result = allResult.filter(
                        (item) => item.rowData.assetType === type,
                    );
                    return res.send(result);
                }

                // if only status is specified
                else if (type === "null" && status !== "null") {
                    const allData = await RequestDB.find().toArray();
                    const allResult = allData.filter(
                        (item) => item.email === email,
                    );
                    result = allResult.filter((item) => item.status === status);
                    return res.send(result);
                }

                // if status and type are specified
                else if (type !== "null" && status !== "null") {
                    const allData = await RequestDB.find().toArray();
                    const allResult = allData.filter(
                        (item) => item.email === email,
                    );
                    result = allResult.filter(
                        (item) =>
                            item.rowData.assetType === type &&
                            item.status === status,
                    );
                    return res.send(result);
                }
            }

            // if search is specified
            else {
                const agg = [
                    {
                        $search: {
                            index: "requestSearch",
                            text: {
                                query: search,
                                path: {
                                    wildcard: "*",
                                },
                                fuzzy: {},
                            },
                        },
                    },
                ];

                const cursor = RequestDB.aggregate(agg);
                const allData = await cursor.toArray();
                const searchResult = allData.filter(
                    (item) => item.email === email,
                );

                if (type === "null" && status === "null") {
                    // if no type, status is specified
                    result = searchResult;
                    return res.send(result);
                }

                // if only type is specified
                else if (type !== "null" && status === "null") {
                    result = searchResult.filter(
                        (item) => item.rowData.assetType === type,
                    );
                    return res.send(result);
                }

                // if only status is specified
                else if (type === "null" && status !== "null") {
                    result = searchResult.filter(
                        (item) => item.status === status,
                    );
                    return res.send(result);
                }

                // if status and type are specified
                else if (type !== "null" && status !== "null") {
                    result = searchResult.filter(
                        (item) =>
                            item.rowData.assetType === type &&
                            item.status === status,
                    );
                    return res.send(result);
                }
            }
        });

        app.put("/request", async (req, res) => {
            const id = req.query.id;
            const status = req.body.status;
            const approvedTime = req.body.approvedTime;

            const result = await RequestDB.updateOne(
                { _id: new ObjectId(id) },
                { $set: { status: status, approvedTime: approvedTime } },
            );
            res.send(result);
        });

        app.post("/request", async (req, res) => {
            const request = req.body;
            const result = await RequestDB.insertOne(request);
            res.send(result);
        });

        /********************** Asset Services done ********************/

        /************************** Employee Services ******************/
        app.get("/employee", async (req, res) => {
            const id = req.query.id;

            if (!id) {
                const result = await UserDB.find({
                    $and: [{ role: "employee" }, { company: "notAffiliated" }],
                }).toArray();

                return res.send(result);
            }
            const result = await UserDB.findOne({ _id: new ObjectId(id) });
            res.send(result);
        });
    } finally {
        // hello
    }
}
run().catch(console.dir);

// test server connection
app.get("/", (req, res) => {
    res.send("Server is running...");
});

// Listening
app.listen(port);
