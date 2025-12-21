const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

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

    // --- User Related APIs ---
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

    // --- Donation Request APIs ---
    app.post('/donation-requests', async (req, res) => {
      const request = req.body;
      const result = await donationCollection.insertOne(request);
      res.send(result);
    });

    // এই রুটটি আমি শুধু অ্যাড করলাম আপনার ডিটেইলস পেজের জন্য
    app.get('/donation-request-details/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationCollection.findOne(query);
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

    app.get('/all-donation-requests', async (req, res) => {
      const result = await donationCollection.find().toArray();
      res.send(result);
    });

    app.patch('/donation-requests/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = { $set: { ...req.body } };
      const result = await donationCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete('/donation-requests/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationCollection.deleteOne(query);
      res.send(result);
    });

    // --- BLOG APIs ---
    app.post('/blogs', async (req, res) => {
      const blog = req.body;
      const result = await blogCollection.insertOne(blog);
      res.send(result);
    });

    app.get('/all-blogs', async (req, res) => {
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

    app.delete('/blogs/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogCollection.deleteOne(query);
      res.send(result);
    });

    // --- Admin Stats ---
    app.get('/admin-stats', async (req, res) => {
      const usersCount = await userCollection.estimatedDocumentCount();
      const requestsCount = await donationCollection.estimatedDocumentCount();
      const successfulDonations = await donationCollection.countDocuments({ status: 'done' });
      res.send({
        users: usersCount,
        requests: requestsCount,
        doneDonations: successfulDonations
      });
    });


   
app.get('/users/:email', async (req, res) => {
    const email = req.params.email;
    const query = { email: email };
    const result = await userCollection.findOne(query);
    
    if (result) {
        res.send(result);
    } else {
        res.status(404).send({ message: "User not found" });
    }
});


// ইউজারের প্রোফাইল আপডেট করার API
app.put('/user/update/:email', async (req, res) => {
    const email = req.params.email;
    const updatedUser = req.body;
    
    const filter = { email: email };
    const updateDoc = {
        $set: {
            name: updatedUser.name,
            avatar: updatedUser.avatar,
            bloodGroup: updatedUser.bloodGroup,
            district: updatedUser.district,
            upazila: updatedUser.upazila,
        }
    };

    try {
        const result = await userCollection.updateOne(filter, updateDoc);
        if (result.matchedCount > 0) {
            res.send(result);
        } else {
            res.status(404).send({ message: "User not found in database" });
        }
    } catch (error) {
        res.status(500).send({ message: "Internal Server Error", error });
    }
});

app.get('/featured-blogs', async (req, res) => {
    try {
        
        const query = { status: 'published' };
        const result = await blogCollection
            .find(query)
            .sort({ _id: -1 }) 
            .limit(3)
            .toArray();
            
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Error fetching blogs", error });
    }
});


    // --- Search Donors ---
    app.get('/search-donors', async (req, res) => {
      const { bloodGroup, district, upazila } = req.query;
      let query = { role: 'donor' };
      if (bloodGroup) query.bloodGroup = bloodGroup;
      if (district) query.district = district;
      if (upazila) query.upazila = upazila;
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. Connected to MongoDB!");
  } finally {
    // Keep connection open
  }
}
run().catch(console.dir);

app.get('/', (req, res) => { res.send("Blood Donation Server is running"); });
app.listen(port, () => { console.log(`Server is running on port ${port}`); });