const express = require('express')
require('dotenv').config()
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const admin = require('firebase-admin') 
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

// --- Firebase Admin Initialization Start ---
const formatPrivateKey = (key) => {
  if (!key) return undefined;
  return key.replace(/\\n/g, '\n');
};

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
      }),
    });
    console.log("✅ Firebase Admin Initialized");
  } catch (error) {
    console.error("❌ Firebase Init Error:", error.message);
  }
}
// --- Firebase Admin Initialization End ---

const port = process.env.PORT || 5000
const app = express()

app.use(
  cors({
    origin: ['http://localhost:5173', 'https://blood-donation-11.vercel.app'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  }),
)
app.use(express.json())



const verifyToken = async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  const token = req.headers.authorization.split(' ')[1]
  try {
    const decodedUser = await admin.auth().verifyIdToken(token);
    req.decoded = decodedUser;
    next();
  } catch (error) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.buxlnsp.mongodb.net/?retryWrites=true&w=majority`
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    // await client.connect(); // Vercel-এ এটি অপশনাল, তবে লোকাল চেক করতে পারেন
    
    const db = client.db('bloodDonationDB')
    const userCollection = db.collection('users')
    const donationCollection = db.collection('donationRequests')
    const blogCollection = db.collection('blogs')
    const paymentCollection = db.collection('payments')

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      const isAdmin = user?.role === 'admin'
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next()
    }

    app.post('/jwt', async (req, res) => {
      res.send({ message: 'Using Firebase Token directly' })
    })

    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray()
      res.send(result)
    })

    app.post('/users', async (req, res) => {
      const user = req.body
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.status(400).send({ message: 'User already exists', insertedId: null })
      }
      const result = await userCollection.insertOne({
        ...user,
        role: 'donor',
        status: 'active',
      })
      res.send(result)
    })

    app.get('/users/role/:email', async (req, res) => {
      const email = req.params.email
      const result = await userCollection.findOne({ email: email })
      res.send(result)
    })

    app.patch('/users/role/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id
      const { role } = req.body
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = { $set: { role: role } }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    app.patch('/users/status/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id
      const { status } = req.body
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = { $set: { status: status } }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    app.post('/donation-requests', verifyToken, async (req, res) => {
      const email = req.decoded.email
      const user = await userCollection.findOne({ email: email })
      if (user?.status === 'blocked') {
        return res.status(403).send({ message: 'Blocked users cannot create requests' })
      }
      const request = req.body
      const result = await donationCollection.insertOne(request)
      res.send(result)
    })

    app.get('/donation-request-details/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await donationCollection.findOne(query)
      res.send(result)
    })

    app.get('/donation-requests/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      const query = { requesterEmail: email }
      const result = await donationCollection.find(query).toArray()
      res.send(result)
    })

    app.get('/donation-requests/recent/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      const query = { requesterEmail: email }
      const result = await donationCollection
        .find(query)
        .sort({ _id: -1 })
        .limit(3)
        .toArray()
      res.send(result)
    })

    app.get('/all-donation-requests', async (req, res) => {
      const result = await donationCollection.find().toArray()
      res.send(result)
    })

    app.patch('/donation-requests/:id', verifyToken, async (req, res) => {
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = { $set: { ...req.body } }
      const result = await donationCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    app.delete('/donation-requests/:id', verifyToken, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await donationCollection.deleteOne(query)
      res.send(result)
    })

    app.get('/public-stats', async (req, res) => {
      const usersCount = await userCollection.estimatedDocumentCount()
      const requestsCount = await donationCollection.estimatedDocumentCount()
      const successfulDonations = await donationCollection.countDocuments({ status: 'done' })
      res.send({ users: usersCount, requests: requestsCount, doneDonations: successfulDonations })
    })

    app.post('/blogs', verifyToken, async (req, res) => {
      const blog = req.body
      const result = await blogCollection.insertOne(blog)
      res.send(result)
    })

    app.get('/all-blogs', async (req, res) => {
      const result = await blogCollection.find().toArray()
      res.send(result)
    })

    app.patch('/blogs/:id', verifyToken, async (req, res) => {
      const id = req.params.id
      const { status } = req.body
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = { $set: { status: status } }
      const result = await blogCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    app.delete('/blogs/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await blogCollection.deleteOne(query)
      res.send(result)
    })

    app.get('/featured-blogs', async (req, res) => {
      const query = { status: 'published' }
      const result = await blogCollection
        .find(query)
        .sort({ _id: -1 })
        .limit(3)
        .toArray()
      res.send(result)
    })

    app.post('/create-payment-intent', verifyToken, async (req, res) => {
      const { price } = req.body
      const amount = Math.round(price * 100) // parseInt এর বদলে round নিরাপদ
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      })
      res.send({ clientSecret: paymentIntent.client_secret })
    })

    app.post('/payments', verifyToken, async (req, res) => {
      const payment = req.body
      const result = await paymentCollection.insertOne(payment)
      res.send(result)
    })

    app.get('/payments/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email }
      const result = await paymentCollection.find(query).toArray()
      res.send(result)
    })

    app.get('/all-payments', verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentCollection.find().toArray()
      res.send(result)
    })

    app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
      const usersCount = await userCollection.estimatedDocumentCount()
      const requestsCount = await donationCollection.estimatedDocumentCount()
      const successfulDonations = await donationCollection.countDocuments({ status: 'done' })
      const payments = await paymentCollection.find().toArray()
      const totalFunds = payments.reduce((sum, payment) => sum + (payment.price || 0), 0)
      res.send({ users: usersCount, requests: requestsCount, doneDonations: successfulDonations, totalFunding: totalFunds })
    })

    app.get('/donors-search', async (req, res) => {
      const { bloodGroup, district, upazila } = req.query
      let query = { role: 'donor' }
      if (bloodGroup) query.bloodGroup = bloodGroup
      if (district) query.district = district
      if (upazila) query.upazila = upazila
      const result = await userCollection.find(query).toArray()
      res.send(result)
    })

    app.get('/users/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      const result = await userCollection.findOne({ email: email })
      if (result) {
        res.send(result)
      } else {
        res.status(404).send({ message: 'User not found' })
      }
    })

    app.put('/user/update/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      const updatedUser = req.body
      const filter = { email: email }
      const updateDoc = {
        $set: {
          name: updatedUser.name,
          avatar: updatedUser.avatar,
          bloodGroup: updatedUser.bloodGroup,
          district: updatedUser.district,
          upazila: updatedUser.upazila,
        },
      }
      const result = await userCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

  } catch (err) {
    console.error(err);
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Blood Donation Server is running')
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})