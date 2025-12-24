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

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.buxlnsp.mongodb.net/?appName=Cluster0`;
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

        // Fixed verifyToken Middleware
        const verifyToken = async (req, res, next) => {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = authHeader.split(' ')[1];
            try {
                const decodedUser = await admin.auth().verifyIdToken(token);
                req.decoded = decodedUser;
                next();
            } catch (error) {
                console.error("Firebase Verify Error:", error.message);
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

        // --- ROUTES ---

        app.post('/jwt', async (req, res) => {
            res.send({ success: true });
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

        app.get('/pending-donation-requests', async (req, res) => {
            const result = await donationCollection.find({ status: 'pending' }).toArray();
            res.send(result);
        });

        app.get('/donation-details/:id', verifyToken, async (req, res) => {
            const query = { _id: new ObjectId(req.params.id) };
            const result = await donationCollection.findOne(query);
            res.send(result);
        });

        app.get('/all-blogs', async (req, res) => {
            const result = await blogCollection.find().toArray();
            res.send(result);
        });

        app.get('/users/role/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email });
            res.send({ role: user?.role || 'donor' });
        });

        app.get('/users/:email', verifyToken, async (req, res) => {
            const result = await userCollection.findOne({ email: req.params.email });
            res.send(result);
        });

        app.put('/user/update/:email', verifyToken, async (req, res) => {
            const filter = { email: req.params.email };
            const updatedData = req.body;
            const updateDoc = {
                $set: {
                    name: updatedData.name,
                    image: updatedData.image,
                    district: updatedData.district,
                    upazila: updatedData.upazila,
                    bloodGroup: updatedData.bloodGroup,
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // Donation Requests by User Email
        app.get('/donation-requests/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            // Security check jate nijer data chara onno keu na dekhe
            if (req.decoded.email !== email) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            const result = await donationCollection.find({ requesterEmail: email }).toArray();
            res.send(result);
        });

        app.get('/donation-request-details/:id', verifyToken, async (req, res) => {
            if (!ObjectId.isValid(req.params.id)) return res.status(400).send("Invalid ID");
            const query = { _id: new ObjectId(req.params.id) };
            const result = await donationCollection.findOne(query);
            res.send(result);
        });

        app.patch('/donation-requests/:id', verifyToken, async (req, res) => {
            if (!ObjectId.isValid(req.params.id)) return res.status(400).send("Invalid ID");
            const filter = { _id: new ObjectId(req.params.id) };
            const updatedData = req.body;
            const updateDoc = {
                $set: {
                    recipientName: updatedData.recipientName,
                    district: updatedData.district,
                    upazila: updatedData.upazila,
                    hospitalName: updatedData.hospitalName,
                    fullAddress: updatedData.fullAddress,
                    donationDate: updatedData.donationDate,
                    donationTime: updatedData.donationTime,
                    bloodGroup: updatedData.bloodGroup,
                    description: updatedData.description,
                    status: updatedData.status
                },
            };
            const result = await donationCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        app.delete('/donation-requests/:id', verifyToken, async (req, res) => {
            if (!ObjectId.isValid(req.params.id)) return res.status(400).send("Invalid ID");
            const result = await donationCollection.deleteOne({ _id: new ObjectId(req.params.id) });
            res.send(result);
        });

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        app.patch('/blogs/:id', verifyToken, verifyAdmin, async (req, res) => {
            const filter = { _id: new ObjectId(req.params.id) };
            const updateDoc = { $set: { status: req.body.status } };
            const result = await blogCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        app.get('/all-payments', verifyToken, verifyAdmin, async (req, res) => {
            const result = await paymentCollection.find().toArray();
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

        app.get('/all-donation-requests', async (req, res) => {
            const result = await donationCollection.find().toArray();
            res.send(result);
        });

        app.get('/donation-requests/recent/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) return res.status(403).send({ message: 'forbidden access' });

            const query = { requesterEmail: email };
            const result = await donationCollection.find(query).sort({ _id: -1 }).limit(3).toArray();
            res.send(result);
        });

        app.post('/donation-requests', verifyToken, async (req, res) => {
            const user = await userCollection.findOne({ email: req.decoded.email });
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
            const result = await userCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { role: req.body.role } }
            );
            res.send(result);
        });

        app.patch('/users/status/:id', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { status: req.body.status } }
            );
            res.send(result);
        });

        app.delete('/blogs/:id', verifyToken, verifyAdmin, async (req, res) => {
            const result = await blogCollection.deleteOne({ _id: new ObjectId(req.params.id) });
            res.send(result);
        });

    } finally { }
}
run().catch(console.dir);

app.get('/', (req, res) => res.send('Blood Donation Server is running'));
app.listen(port);