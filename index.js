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

const verifyStaff = async (req, res, next) => {
  const email = req.decoded.email;
  const user = await client.db('bloodDonationDB').collection('users').findOne({ email });
  if (user?.role === 'admin' || user?.role === 'volunteer') {
    req.userRole = user.role;
    next();
  } else {
    return res.status(403).send({ message: 'forbidden access' });
  }
}

const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const user = await client.db('bloodDonationDB').collection('users').findOne({ email });
  if (user?.role === 'admin') {
    next();
  } else {
    return res.status(403).send({ message: 'forbidden access' });
  }
}

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

app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
  const result = await userCollection.find().toArray();
  res.send(result);
});

app.get('/all-donation-requests', verifyToken, verifyStaff, async (req, res) => {
  const result = await donationCollection.find().toArray();
  res.send(result);
});

app.post('/blogs', verifyToken, verifyStaff, async (req, res) => {
  const result = await blogCollection.insertOne(req.body);
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