const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 3000;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection URI
const uri = process.env.DB_URI || "mongodb+srv://Assignment-11:zBa83OMG66J7S6Mp@cluster0.buxlnsp.mongodb.net/?appName=Cluster0";

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

    // --- USER RELATED API ---

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.status(400).send({ message: 'User already exists', insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get('/users/role/:email', async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email: email });
      res.send(result);
    });


    // --- DONATION REQUESTS API ---

    // ১. নতুন রিকোয়েস্ট তৈরি
    app.post('/donation-requests', async (req, res) => {
      const request = req.body;
      const result = await donationCollection.insertOne(request);
      res.send(result);
    });

    // ২. নির্দিষ্ট ইউজারের সব রিকোয়েস্ট (My Donation Requests পেজের জন্য)
    app.get('/donation-requests/:email', async (req, res) => {
      const email = req.params.email;
      const query = { requesterEmail: email };
      const result = await donationCollection.find(query).toArray();
      res.send(result);
    });

    // ৩. ড্যাশবোর্ড হোমের জন্য সর্বশেষ ৩টি রিকোয়েস্ট
    app.get('/donation-requests/recent/:email', async (req, res) => {
      const email = req.params.email;
      const query = { requesterEmail: email };
      const result = await donationCollection.find(query).sort({ _id: -1 }).limit(3).toArray();
      res.send(result);
    });

    // ৪. নির্দিষ্ট একটি রিকোয়েস্ট গেট করা (এডিট পেজে ডাটা দেখানোর জন্য) ✨ (New)
    app.get('/donation-request-details/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationCollection.findOne(query);
      res.send(result);
    });

    // ৫. রিকোয়েস্ট আপডেট/এডিট করা ✨ (New)
    app.patch('/donation-requests/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          recipientName: req.body.recipientName,
          recipientDistrict: req.body.recipientDistrict,
          recipientUpazila: req.body.recipientUpazila,
          hospitalName: req.body.hospitalName,
          fullAddress: req.body.fullAddress,
          donationDate: req.body.donationDate,
          donationTime: req.body.donationTime,
          requestMessage: req.body.requestMessage,
        }
      };
      const result = await donationCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // ৬. রিকোয়েস্ট ডিলিট করা
    app.delete('/donation-requests/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationCollection.deleteOne(query);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. Connected to MongoDB!");
  } finally { }
}
run().catch(console.dir);

app.get('/', (req, res) => { res.send("Blood Donation Server is running"); });
app.listen(port, () => { console.log(`Server is running on ${port}`); });