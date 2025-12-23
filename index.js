const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
    origin: [
        'https://blood-donation-11.vercel.app',
        'http://localhost:5173'
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
}));
app.use(express.json());

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const db = client.db("bloodDonationDB");
        const userCollection = db.collection("users");
        const donationCollection = db.collection("donationRequests");
        const blogCollection = db.collection("blogs");
        const paymentCollection = db.collection("payments");

        const verifyToken = async (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            try {
                const decodedUser = await admin.auth().verifyIdToken(token);
                req.decoded = decodedUser;
                next();
            } catch (error) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
        };

        const verifyStaff = async (req, res, next) => {
            const email = req.decoded?.email;
            const user = await userCollection.findOne({ email });
            if (user?.role === 'admin' || user?.role === 'volunteer') {
                req.userRole = user.role;
                next();
            } else {
                return res.status(403).send({ message: 'forbidden access' });
            }
        };

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded?.email;
            const user = await userCollection.findOne({ email });
            if (user?.role === 'admin') {
                next();
            } else {
                return res.status(403).send({ message: 'forbidden access' });
            }
        };

        app.post('/jwt', async (req, res) => {
            res.send({ success: true, message: 'Token logged' });
        });

        app.get('/public-stats', async (req, res) => {
            const users = await userCollection.estimatedDocumentCount();
            const requests = await donationCollection.estimatedDocumentCount();
            const doneDonations = await donationCollection.countDocuments({ status: 'done' });
            res.send({ users, requests, doneDonations });
        });

        app.get('/featured-blogs', async (req, res) => {
            const result = await blogCollection.find({ status: 'published' }).limit(3).toArray();
            res.send(result);
        });

        app.get('/users/role/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email });
            res.send({ role: user?.role || 'donor' });
        });

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        app.get('/admin-stats', verifyToken, verifyStaff, async (req, res) => {
            const usersCount = await userCollection.estimatedDocumentCount();
            const requestsCount = await donationCollection.estimatedDocumentCount();
            const successfulDonations = await donationCollection.countDocuments({ status: 'done' });
            
            const stats = {
                users: usersCount,
                requests: requestsCount,
                doneDonations: successfulDonations,
            };

            if (req.userRole === 'admin') {
                const payments = await paymentCollection.find().toArray();
                stats.totalFunding = payments.reduce((sum, p) => sum + (p.price || 0), 0);
            }
            res.send(stats);
        });

        app.get('/all-donation-requests', verifyToken, verifyStaff, async (req, res) => {
            const result = await donationCollection.find().toArray();
            res.send(result);
        });

        app.post('/donation-requests', verifyToken, async (req, res) => {
            const email = req.decoded.email;
            const user = await userCollection.findOne({ email: email });
            if (user?.status === 'blocked') {
                return res.status(403).send({ message: 'Blocked users cannot create requests' });
            }
            const result = await donationCollection.insertOne(req.body);
            res.send(result);
        });

        app.post('/blogs', verifyToken, verifyStaff, async (req, res) => {
            const result = await blogCollection.insertOne(req.body);
            res.send(result);
        });

        app.patch('/users/role/:id', verifyToken, verifyAdmin, async (req, res) => {
            const filter = { _id: new ObjectId(req.params.id) };
            const result = await userCollection.updateOne(filter, { $set: { role: req.body.role } });
            res.send(result);
        });

        app.patch('/users/status/:id', verifyToken, verifyAdmin, async (req, res) => {
            const filter = { _id: new ObjectId(req.params.id) };
            const result = await userCollection.updateOne(filter, { $set: { status: req.body.status } });
            res.send(result);
        });

        app.delete('/blogs/:id', verifyToken, verifyAdmin, async (req, res) => {
            const result = await blogCollection.deleteOne({ _id: new ObjectId(req.params.id) });
            res.send(result);
        });

    } finally {}
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Blood Donation Server is running');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});