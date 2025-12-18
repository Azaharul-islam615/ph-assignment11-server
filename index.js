const express = require('express')
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SCRETE);

const app = express()
const port = process.env.PORT || 3000


const admin = require("firebase-admin");

const serviceAccount = require("./ph-assignment11-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// middleware
app.use(express.json())
app.use(cors())

const verifyFBToken = async (req, res, next) => {

  const token = req.headers.authorization
  if (!token) {
    return res.status(401).send({ message: 'unathorized access' })
  }
  try {
    const idToken = token.split(' ')[1]
    const decoded = await admin.auth().verifyIdToken(idToken)

    req.decoded_email = decoded.email
    next();

  }
  catch (err) {
    res.status(401).send({ message: 'unathorized access' })
  }


}

app.get('/', (req, res) => {
  res.send('Hello World!')
})
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jckqi5e.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db('contesthub_db')
    const contestColl = db.collection('contestCollection')
    const paymentColl = db.collection('payment')
    const userColl = db.collection('users')

//  middleware with database access
const verifyAdmin=async(req,res,next)=>{
  const email=req.decoded_email
  const query={email}
  const user=await userColl.findOne(query)
  if(!user || user.role !=='admin'){
    return res.status(403).send({message:'forbidden access'})
  }
  next()
}



    // user ralatated api
    app.get('/users', verifyFBToken, async (req, res) => {
      const cursor = userColl.find()
      const result = await cursor.toArray()
      res.send(result)
    })

    app.get('/users/:id',async(req,res)=>{

    })

    app.get('/users/:email/role',async(req,res)=>{
      const email=req.params.email
      const query={email}
      const user=await userColl.findOne(query)
      res.send({role:user?.role ||'user'})

    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      user.role = 'user'
      user.createdAt = new Date()
      const email = user.email
      const userExist = await userColl.findOne({ email })
      if (userExist) {
        return res.send({ message: 'user exist' })
      }
      const result = userColl.insertOne(user)
      res.send(result)
    })

    app.patch('/users/:id/role',verifyFBToken,verifyAdmin, async (req, res) => {
      const id = req.params.id
      const roleInfo = req.body
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: roleInfo.role
        }
      }
      const result = await userColl.updateOne(query, updateDoc)
      res.send(result)
    })


    //  constest api
    app.get('/contest', async (req, res) => {
      const query = {}
      const { email, status } = req.query
      if (email) {
        query.email = email;
      }
      if (status) {
        query.status = status;
      }
      const cursor = contestColl.find(query)
      const result = await cursor.toArray()
      res.send(result)
    })

    // app.get('/contest', async (req, res) => {
    //   const { status } = req.query;

    //   const query = {};
    //   if (status) {
    //     query.status = status;  
    //   }

    //   const result = await contestColl.find(query).toArray();
    //   res.send(result);
    // });


    app.post("/contest", async (req, res) => {
      const contest = req.body
      contest.status = 'pending'
      contest.createdAt = new Date()
      const result = await contestColl.insertOne(contest)
      res.send(result)
    })


    app.get('/contest/:id', async (req, res) => {
      const id = req.params.id;
      const result = await contestColl.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });


    // Update contest by id
    app.patch("/contest/:id", async (req, res) => {
      const { id } = req.params;      // URL থেকে id নাও
      const updatedData = req.body;   // frontend থেকে পাঠানো data

      try {
        const result = await contestColl.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );

        res.send(result); // MongoDB result return করবে
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });
    // delete contest
    app.delete("/contest/:id", async (req, res) => {
      const { id } = req.params;

      const query = {
        _id: new ObjectId(id)
      }
      const result = await contestColl.deleteOne(query);
      res.send(result)


    });
    app.patch('/contests/:id', async (req, res) => {
      const status = req.body.status
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          status: status
        }
      }
      const result = await contestColl.updateOne(query, updateDoc)
      if (status === 'approved') {
        const email = req.body.email
        const useQuery = { email }
        const updateUser = {
          $set: {
            role: 'contestCreator'
          }
        }
        const userResult = await contestColl.updateOne(useQuery, updateUser)
      }
      res.send(result)
    })


    // payment related api

    app.post('/create-checkout-session', async (req, res) => {
      const paymentInfo = req.body
      const amount = parseInt(paymentInfo.price) * 100;
      const prize_money = parseInt(paymentInfo.prize) * 100
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {

            price_data: {
              currency: 'USD',
              unit_amount: amount,

              product_data: {
                name: paymentInfo.name
              },
            },

            quantity: 1,
          },
        ],

        metadata: {
          contestId: paymentInfo.contestId,
          prizeMoney: prize_money,
          name: paymentInfo.name,
          deadline: paymentInfo.deadline,
          userName: paymentInfo.userName,
          image: paymentInfo.image
        },
        mode: 'payment',
        customer_email: paymentInfo.customer_email,

        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`
      });


      res.send({ url: session.url })
    });

    app.patch('/payment-success', async (req, res) => {
      try {
        const sessionId = req.query.session_id;
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const transactionId = session.payment_intent;

        const paymentExist = await paymentColl.findOne({ transactionId });
        if (paymentExist) {
          return res.send({ message: 'already exist', transactionId });
        }

        if (session.payment_status !== 'paid') {
          return res.send({ success: false, message: 'Payment not completed' });
        }

        // Update contest participants
        const contestId = session.metadata.contestId;
        const updateContest = await contestColl.updateOne(
          { _id: new ObjectId(contestId) },
          { $set: { paymentStatus: 'paid' }, $inc: { participants: 1 } }
        );

        // Insert payment record
        const payment = {
          amount: Number(session.amount_total) / 100,
          customerEmail: session.customer_email,
          contestId: session.metadata.contestId,
          contestName: session.metadata.name,
          prizeMoney: Number(session.metadata.prizeMoney) / 100,
          deadline: session.metadata.deadline,
          paymentStatus: session.payment_status,
          transactionId: session.payment_intent,
          userName: session.metadata.userName,
          image: session.metadata.image,
          paidAt: new Date()
        };

        const insertPayment = await paymentColl.insertOne(payment);

        // Send only once
        res.send({
          success: true,
          modifyContest: updateContest,
          paymentInfo: insertPayment
        });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: 'Server error' });
      }
    });


    app.get('/payments', verifyFBToken, async (req, res) => {
      const email = req.query.email
      const query = {}
      // console.log('headers',req.headers)
      if (email) {
        query.customerEmail = email

        // check email address
        if (email !== req.decoded_email) {
          return res.status(403).send({ message: 'forbidden access' })
        }
      }
      const cursor = paymentColl.find(query)
      const result = await cursor.toArray()
      res.send(result)
    })



    app.patch('/payments/:id', async (req, res) => {
      const { id } = req.params;
      const { submittedTask } = req.body;

      const result = await paymentColl.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            submittedTask: submittedTask,

          }
        }
      );

      res.send(result);
    });
    app.patch("/payments/declare-winner/:id", async (req, res) => {
      const { contestId } = req.body;
      const paymentId = req.params.id;

      // Step 1: check if winner already exists
      const winnerExists = await paymentColl.findOne({
        contestId,
        isWinner: true
      });

      if (winnerExists) {
        return res.status(400).send({
          message: "Winner already declared for this contest"
        });
      }

      // Step 2: set isWinner dynamically
      const result = await paymentColl.updateOne(
        { _id: new ObjectId(paymentId) },
        {
          $set: {
            isWinner: true,
            winnerDeclaredAt: new Date()
          }
        }
      );

      res.send(result);
    });


    app.get('/public-winners', async (req, res) => {
      const winners = await paymentColl.find({ isWinner: true }).toArray();
      res.send(winners);
    });


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error

  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})