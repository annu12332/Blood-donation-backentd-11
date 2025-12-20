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
    const blogCollection = db.collection("blogs"); 
   
  
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

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

    app.patch('/users/role/:id', async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = { $set: { role: role } };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch('/users/status/:id', async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = { $set: { status: status } };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });


    // --- DONATION REQUESTS API ---

    app.post('/donation-requests', async (req, res) => {
      const request = req.body;
      const result = await donationCollection.insertOne(request);
      res.send(result);
    });

    app.get('/donation-requests/:email', async (req, res) => {
      const email = req.params.email;
      const query = { requesterEmail: email };
      const result = await donationCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/donation-requests/recent/:email', async (req, res) => {
      const email = req.params.email;
      const query = { requesterEmail: email };
      const result = await donationCollection.find(query).sort({ _id: -1 }).limit(3).toArray();
      res.send(result);
    });

    app.get('/donation-request-details/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationCollection.findOne(query);
      res.send(result);
    });

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

    app.delete('/donation-requests/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationCollection.deleteOne(query);
      res.send(result);
    });


    // --- BLOG RELATED API ---

    app.post('/blogs', async (req, res) => {
      const blog = req.body;
      const result = await blogCollection.insertOne(blog);
      res.send(result);
    });

    app.get('/blogs', async (req, res) => {
      const result = await blogCollection.find().toArray();
      res.send(result);
    });

    app.patch('/blogs/:id', async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = { $set: { status: status } };
      const result = await blogCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

   
    app.patch('/donation-requests/donate/:id', async (req, res) => {
      const id = req.params.id;
      const { donorName, donorEmail, status } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          donorName: donorName,
          donorEmail: donorEmail,
          donationStatus: status 
        }
      };
      const result = await donationCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.get('/donation-request-details/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await donationCollection.findOne(query);
    res.send(result);
});


app.get('/admin-stats', async (req, res) => {
    try {
        const usersCount = await userCollection.estimatedDocumentCount();
        const requestsCount = await donationCollection.estimatedDocumentCount();
        
        
        const successfulDonations = await donationCollection.countDocuments({ 
            donationStatus: 'done' 
        });

        res.send({
            users: usersCount,
            requests: requestsCount,
            doneDonations: successfulDonations
        });
    } catch (error) {
        res.status(500).send({ message: "Error fetching stats" });
    }
});



    // --- SEARCH DONORS API ---

    app.get('/search-donors', async (req, res) => {
      const { bloodGroup, district, upazila } = req.query;
      let query = { role: 'donor' };

      
      if (bloodGroup && bloodGroup !== "") query.bloodGroup = bloodGroup;
      if (district && district !== "") query.district = district;
      if (upazila && upazila !== "") query.upazila = upazila;

      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. Connected to MongoDB!");
  } finally { }
}
run().catch(console.dir);

app.get('/', (req, res) => { res.send("Blood Donation Server is running"); });
app.listen(port, () => { console.log(`Server is running on ${port}`); });